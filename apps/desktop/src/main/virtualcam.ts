import { spawn, ChildProcess } from 'child_process'
import { platform } from 'os'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

export type VCamStatus = 'idle' | 'starting' | 'active' | 'error' | 'unsupported'

export interface VCamInfo {
  supported: boolean
  reason: string
  device?: string
}

function findV4l2LoopbackDevice(): string | null {
  try {
    for (const dev of readdirSync('/sys/class/video4linux')) {
      try {
        const name = readFileSync(`/sys/class/video4linux/${dev}/name`, 'utf8').trim().toLowerCase()
        if (name.includes('dummy') || name.includes('loopback')) return `/dev/${dev}`
      } catch { /* skip */ }
    }
  } catch { /* no v4l */ }
  for (let i = 0; i < 10; i++) {
    if (existsSync(`/dev/video${i}`)) return `/dev/video${i}`
  }
  return null
}

export function getPlatformInfo(): VCamInfo {
  const os = platform()

  if (os !== 'linux') {
    const label = os === 'darwin' ? 'macOS' : os === 'win32' ? 'Windows' : 'Platform ini'
    return { supported: false, reason: `${label}: coming soon. Untuk sekarang gunakan OBS.` }
  }

  try {
    execSync('which ffmpeg', { stdio: 'ignore' })
  } catch {
    return { supported: false, reason: 'ffmpeg tidak ditemukan. Jalankan: sudo apt install ffmpeg' }
  }

  const device = findV4l2LoopbackDevice()
  if (!device) {
    return {
      supported: false,
      reason: 'v4l2loopback belum dimuat. Jalankan:\nsudo modprobe v4l2loopback'
    }
  }

  return { supported: true, reason: '', device }
}

export class VirtualCamera {
  private ffmpeg: ChildProcess | null = null
  private info: VCamInfo
  private statusCb: ((s: VCamStatus) => void) | null = null
  private armed = false
  private frameW = 0
  private frameH = 0

  constructor() {
    this.info = getPlatformInfo()
  }

  getInfo(): VCamInfo { return this.info }

  arm(onStatus: (s: VCamStatus) => void): void {
    this.statusCb = onStatus
    this.armed = true
    if (!this.info.supported) {
      onStatus('unsupported')
    } else {
      onStatus('starting')
    }
  }

  writeFrame(data: Buffer, width: number, height: number): void {
    if (!this.armed || !this.info.supported || !this.info.device) return

    if (!this.ffmpeg || this.frameW !== width || this.frameH !== height) {
      this.startFfmpeg(width, height)
    }

    this.ffmpeg?.stdin?.write(data)
  }

  private startFfmpeg(width: number, height: number): void {
    this.stopFfmpeg()
    this.frameW = width
    this.frameH = height

    this.ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'rawvideo', '-pixel_format', 'rgba',
      '-video_size', `${width}x${height}`,
      '-framerate', '15',
      '-i', 'pipe:0',
      '-f', 'v4l2', '-pix_fmt', 'yuv420p',
      this.info.device!
    ], { stdio: ['pipe', 'ignore', 'ignore'] })

    this.ffmpeg.on('spawn', () => this.statusCb?.('active'))
    this.ffmpeg.on('error', (err) => {
      console.error('[VCam] ffmpeg error:', err)
      this.ffmpeg = null
      this.statusCb?.('error')
    })
    this.ffmpeg.on('close', () => {
      this.ffmpeg = null
      if (this.armed) this.statusCb?.('idle')
    })
  }

  private stopFfmpeg(): void {
    if (this.ffmpeg) {
      this.ffmpeg.stdin?.end()
      this.ffmpeg.kill('SIGTERM')
      this.ffmpeg = null
    }
  }

  disarm(): void {
    this.armed = false
    this.stopFfmpeg()
    this.statusCb?.('idle')
    this.statusCb = null
  }

  destroy(): void {
    this.armed = false
    this.stopFfmpeg()
  }
}

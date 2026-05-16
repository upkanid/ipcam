import { spawn, ChildProcess, execSync } from 'child_process'
import { platform, tmpdir } from 'os'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type VCamStatus = 'idle' | 'starting' | 'active' | 'error' | 'unsupported'

export interface VCamInfo {
  supported: boolean
  reason: string
  device?: string
  backend?: 'ffmpeg' | 'pyvirtualcam'
}

/* ── Python helper script for macOS / Windows ──────────── */

const VCAM_HELPER_PY = `
import sys

def main():
    width = int(sys.argv[1])
    height = int(sys.argv[2])
    fps = int(sys.argv[3])
    frame_size = width * height * 4

    import pyvirtualcam, numpy as np
    with pyvirtualcam.Camera(width=width, height=height, fps=fps) as cam:
        sys.stderr.write("VCAM_READY:" + cam.device + "\\n")
        sys.stderr.flush()
        while True:
            data = sys.stdin.buffer.read(frame_size)
            if len(data) < frame_size:
                break
            frame = np.frombuffer(data, dtype=np.uint8).reshape((height, width, 4))
            cam.send(frame[:, :, :3].copy())
            cam.sleep_until_next_frame()

if __name__ == "__main__":
    main()
`.trim()

/* ── Linux: find v4l2loopback device ───────────────────── */

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

/* ── Cross-platform: find python + pyvirtualcam ────────── */

function findPython(): string | null {
  const cmds = platform() === 'win32' ? ['python', 'python3'] : ['python3', 'python']
  for (const cmd of cmds) {
    try {
      const ver = execSync(`${cmd} --version`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      const match = ver.match(/Python\s+(\d+)/)
      if (match && parseInt(match[1]) >= 3) return cmd
    } catch { /* skip */ }
  }
  return null
}

function hasPyvirtualcam(pythonCmd: string): boolean {
  try {
    execSync(`${pythonCmd} -c "import pyvirtualcam"`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/* ── Platform detection ────────────────────────────────── */

function getLinuxInfo(): VCamInfo {
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

  return { supported: true, reason: '', device, backend: 'ffmpeg' }
}

function getDarwinInfo(): VCamInfo {
  const py = findPython()
  if (!py) {
    return {
      supported: false,
      reason: 'Python 3 tidak ditemukan.\n\nInstall via: brew install python3'
    }
  }

  if (!hasPyvirtualcam(py)) {
    return {
      supported: false,
      reason: `pyvirtualcam belum terinstall.\n\nJalankan:\n${py} -m pip install pyvirtualcam numpy\n\nPastikan OBS Studio sudah terinstall (dibutuhkan untuk virtual camera).`
    }
  }

  return { supported: true, reason: '', device: 'OBS Virtual Camera', backend: 'pyvirtualcam' }
}

function getWindowsInfo(): VCamInfo {
  const py = findPython()
  if (!py) {
    return {
      supported: false,
      reason: 'Python 3 tidak ditemukan.\n\nDownload dari: https://www.python.org/downloads/'
    }
  }

  if (!hasPyvirtualcam(py)) {
    return {
      supported: false,
      reason: `pyvirtualcam belum terinstall.\n\nJalankan:\n${py} -m pip install pyvirtualcam numpy\n\nPastikan OBS Studio sudah terinstall (dibutuhkan untuk virtual camera).`
    }
  }

  return { supported: true, reason: '', device: 'OBS Virtual Camera', backend: 'pyvirtualcam' }
}

export function getPlatformInfo(): VCamInfo {
  const os = platform()
  if (os === 'linux') return getLinuxInfo()
  if (os === 'darwin') return getDarwinInfo()
  if (os === 'win32') return getWindowsInfo()
  return { supported: false, reason: 'Platform tidak didukung.' }
}

/* ── Virtual camera class ──────────────────────────────── */

export class VirtualCamera {
  private proc: ChildProcess | null = null
  private info: VCamInfo
  private statusCb: ((s: VCamStatus) => void) | null = null
  private armed = false
  private frameW = 0
  private frameH = 0
  private helperPath: string | null = null

  constructor() {
    this.info = getPlatformInfo()
  }

  getInfo(): VCamInfo { return this.info }

  recheck(): VCamInfo {
    this.info = getPlatformInfo()
    return this.info
  }

  arm(onStatus: (s: VCamStatus) => void): void {
    this.info = getPlatformInfo()
    this.statusCb = onStatus
    this.armed = true
    if (!this.info.supported) {
      onStatus('unsupported')
    } else {
      onStatus('starting')
    }
  }

  writeFrame(data: Buffer, width: number, height: number): void {
    if (!this.armed || !this.info.supported) return

    if (!this.proc || this.frameW !== width || this.frameH !== height) {
      this.startProcess(width, height)
    }

    this.proc?.stdin?.write(data)
  }

  private startProcess(width: number, height: number): void {
    this.stopProcess()
    this.frameW = width
    this.frameH = height

    if (this.info.backend === 'pyvirtualcam') {
      this.startPyvirtualcam(width, height)
    } else {
      this.startFfmpeg(width, height)
    }
  }

  private startFfmpeg(width: number, height: number): void {
    this.proc = spawn('ffmpeg', [
      '-y',
      '-f', 'rawvideo', '-pixel_format', 'rgba',
      '-video_size', `${width}x${height}`,
      '-framerate', '15',
      '-i', 'pipe:0',
      '-f', 'v4l2', '-pix_fmt', 'yuv420p',
      this.info.device!
    ], { stdio: ['pipe', 'ignore', 'ignore'] })

    this.proc.on('spawn', () => this.statusCb?.('active'))
    this.proc.on('error', (err) => {
      console.error('[VCam] ffmpeg error:', err)
      this.proc = null
      this.statusCb?.('error')
    })
    this.proc.on('close', () => {
      this.proc = null
      if (this.armed) this.statusCb?.('idle')
    })
  }

  private startPyvirtualcam(width: number, height: number): void {
    if (!this.helperPath) {
      this.helperPath = join(tmpdir(), 'ipcam_vcam_helper.py')
      writeFileSync(this.helperPath, VCAM_HELPER_PY, 'utf8')
    }

    const py = findPython()
    if (!py) {
      this.statusCb?.('error')
      return
    }

    this.proc = spawn(py, [this.helperPath, String(width), String(height), '15'], {
      stdio: ['pipe', 'ignore', 'pipe']
    })

    let ready = false
    this.proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (!ready && text.includes('VCAM_READY:')) {
        ready = true
        const device = text.split('VCAM_READY:')[1]?.trim()
        if (device) this.info.device = device
        this.statusCb?.('active')
      } else {
        console.error('[VCam] pyvirtualcam:', text.trim())
      }
    })

    this.proc.on('error', (err) => {
      console.error('[VCam] python error:', err)
      this.proc = null
      this.statusCb?.('error')
    })

    this.proc.on('close', (code) => {
      this.proc = null
      if (this.armed) {
        this.statusCb?.(code !== 0 ? 'error' : 'idle')
      }
    })

    setTimeout(() => {
      if (this.armed && !ready && this.proc) {
        console.error('[VCam] pyvirtualcam timeout — no VCAM_READY received')
        this.stopProcess()
        this.statusCb?.('error')
      }
    }, 8000)
  }

  private stopProcess(): void {
    if (this.proc) {
      this.proc.stdin?.end()
      this.proc.kill('SIGTERM')
      this.proc = null
    }
  }

  disarm(): void {
    this.armed = false
    this.stopProcess()
    this.statusCb?.('idle')
    this.statusCb = null
  }

  destroy(): void {
    this.armed = false
    this.stopProcess()
  }
}

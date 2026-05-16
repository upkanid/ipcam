import { spawn, ChildProcess, execSync } from 'child_process'
import { platform, tmpdir } from 'os'
import { writeFileSync } from 'fs'
import { join } from 'path'

export type VMicStatus = 'idle' | 'starting' | 'active' | 'error' | 'unsupported'

export interface VMicInfo {
  supported: boolean
  reason: string
  device?: string
}

/* ── Python helper: writes PCM float32 mono to virtual audio device ── */

const VMIC_HELPER_PY = `
import sys, struct

def main():
    sample_rate = int(sys.argv[1])
    device_name = sys.argv[2]
    chunk_samples = int(sys.argv[3])
    chunk_bytes = chunk_samples * 4  # float32

    import sounddevice as sd
    import numpy as np

    stream = sd.OutputStream(
        samplerate=sample_rate,
        channels=1,
        dtype='float32',
        device=device_name,
        blocksize=chunk_samples,
    )
    stream.start()
    sys.stderr.write("VMIC_READY\\n")
    sys.stderr.flush()

    while True:
        data = sys.stdin.buffer.read(chunk_bytes)
        if len(data) < chunk_bytes:
            break
        frame = np.frombuffer(data, dtype=np.float32)
        stream.write(frame.reshape(-1, 1))

    stream.stop()
    stream.close()

if __name__ == "__main__":
    main()
`.trim()

/* ── Cross-platform: find python ── */

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

function hasSounddevice(py: string): boolean {
  try {
    execSync(`${py} -c "import sounddevice"`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/* ── Detect virtual audio device per platform ── */

function findVirtualAudioDevice(py: string): string | null {
  try {
    const out = execSync(
      `${py} -c "import sounddevice as sd; [print(d['name']) for d in sd.query_devices() if d['max_output_channels']>0]"`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString()

    const lines = out.split('\n').map(l => l.trim()).filter(Boolean)
    const keywords = ['blackhole', 'vb-cable', 'cable input', 'virtual', 'pipewire']
    for (const line of lines) {
      if (keywords.some(k => line.toLowerCase().includes(k))) return line
    }
  } catch { /* skip */ }
  return null
}

function getLinuxInfo(py: string): VMicInfo {
  // On Linux, PipeWire/PulseAudio virtual source is simplest
  try {
    execSync('pactl info', { stdio: 'ignore' })
  } catch {
    return { supported: false, reason: 'PulseAudio/PipeWire tidak ditemukan.' }
  }

  if (!hasSounddevice(py)) {
    return {
      supported: false,
      reason: `sounddevice belum terinstall.\n\nJalankan:\n${py} -m pip install sounddevice numpy`
    }
  }

  const device = findVirtualAudioDevice(py)
  if (!device) {
    return {
      supported: false,
      reason: 'Virtual audio device tidak ditemukan.\n\nJalankan:\npactl load-module module-null-sink sink_name=ipcam_vmic sink_properties=device.description=IPCam_Mic\npactl load-module module-virtual-source source_name=ipcam_mic master=ipcam_vmic.monitor'
    }
  }

  return { supported: true, reason: '', device }
}

function getDarwinInfo(py: string): VMicInfo {
  if (!hasSounddevice(py)) {
    return {
      supported: false,
      reason: `sounddevice belum terinstall.\n\nJalankan:\n${py} -m pip install sounddevice numpy`
    }
  }

  const device = findVirtualAudioDevice(py)
  if (!device) {
    return {
      supported: false,
      reason: 'Virtual audio device tidak ditemukan.\n\nInstall BlackHole:\nbrew install blackhole-2ch\n\nSetelah install, pilih "BlackHole 2ch" sebagai mic di Zoom/Meet.'
    }
  }

  return { supported: true, reason: '', device }
}

function getWindowsInfo(py: string): VMicInfo {
  if (!hasSounddevice(py)) {
    return {
      supported: false,
      reason: `sounddevice belum terinstall.\n\nJalankan:\n${py} -m pip install sounddevice numpy`
    }
  }

  const device = findVirtualAudioDevice(py)
  if (!device) {
    return {
      supported: false,
      reason: 'Virtual audio device tidak ditemukan.\n\nInstall VB-Cable:\nhttps://vb-audio.com/Cable/\n\nSetelah install, pilih "CABLE Output" sebagai mic di Zoom/Meet.'
    }
  }

  return { supported: true, reason: '', device }
}

export function getVMicPlatformInfo(): VMicInfo {
  const py = findPython()
  if (!py) {
    return {
      supported: false,
      reason: 'Python 3 tidak ditemukan.\n\nInstall via: brew install python3 (macOS) atau https://python.org (Windows)'
    }
  }

  const os = platform()
  if (os === 'linux') return getLinuxInfo(py)
  if (os === 'darwin') return getDarwinInfo(py)
  if (os === 'win32') return getWindowsInfo(py)
  return { supported: false, reason: 'Platform tidak didukung.' }
}

/* ── Virtual Mic class ── */

export class VirtualMic {
  private proc: ChildProcess | null = null
  private info: VMicInfo
  private statusCb: ((s: VMicStatus) => void) | null = null
  private armed = false
  private helperPath: string | null = null
  private sampleRate = 48000
  private chunkSamples = 4800 // 100ms at 48kHz

  constructor() {
    this.info = getVMicPlatformInfo()
  }

  getInfo(): VMicInfo { return this.info }

  recheck(): VMicInfo {
    this.info = getVMicPlatformInfo()
    return this.info
  }

  arm(onStatus: (s: VMicStatus) => void): void {
    this.info = getVMicPlatformInfo()
    this.statusCb = onStatus
    this.armed = true
    if (!this.info.supported) {
      onStatus('unsupported')
    } else {
      onStatus('starting')
      this.startProcess()
    }
  }

  writeAudio(data: Buffer): void {
    if (!this.armed || !this.proc) return
    this.proc.stdin?.write(data)
  }

  private startProcess(): void {
    this.stopProcess()

    if (!this.helperPath) {
      this.helperPath = join(tmpdir(), 'ipcam_vmic_helper.py')
      writeFileSync(this.helperPath, VMIC_HELPER_PY, 'utf8')
    }

    const py = findPython()
    if (!py) {
      this.statusCb?.('error')
      return
    }

    this.proc = spawn(py, [
      this.helperPath,
      String(this.sampleRate),
      this.info.device!,
      String(this.chunkSamples),
    ], { stdio: ['pipe', 'ignore', 'pipe'] })

    const thisProc = this.proc
    let ready = false

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (!ready && text.includes('VMIC_READY')) {
        ready = true
        this.statusCb?.('active')
      } else {
        console.error('[VMic] python:', text.trim())
      }
    })

    this.proc.on('error', (err) => {
      console.error('[VMic] error:', err)
      if (this.proc === thisProc) this.proc = null
      this.statusCb?.('error')
    })

    this.proc.on('close', (code) => {
      if (this.proc === thisProc) this.proc = null
      if (this.armed) {
        this.statusCb?.(code !== 0 ? 'error' : 'idle')
      }
    })

    setTimeout(() => {
      if (this.armed && !ready && this.proc === thisProc) {
        console.error('[VMic] timeout — no VMIC_READY received')
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

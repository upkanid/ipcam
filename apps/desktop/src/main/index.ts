import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { createSignalingServer, getLocalIP } from './signaling'
import { VirtualCamera, getPlatformInfo } from './virtualcam'
import { VirtualMic, getVMicPlatformInfo } from './virtualmic'

let stopSignaling: () => void
let virtualCam: VirtualCamera
let virtualMic: VirtualMic

const MAX_FRAME_BYTES = 1280 * 1280 * 4
const MAX_AUDIO_BYTES = 4800 * 4

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535
}

function canOpenExternal(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.on('close', () => {
    virtualCam?.disarm()
    virtualMic?.disarm()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternal(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Allow DevTools in production via F12 or Ctrl+Shift+I
  win.webContents.on('before-input-event', (_event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.key === 'F12' || (input.key === 'I' && input.control && input.shift))
    ) {
      win.webContents.toggleDevTools()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

const RELEASES_URL = 'https://github.com/upkanid/ipcam/releases/latest'

function setupAutoUpdater(win: BrowserWindow): void {
  if (is.dev) return

  const isMac = process.platform === 'darwin'

  // macOS: can't silently install without notarization — just detect and redirect
  autoUpdater.autoDownload = !isMac
  autoUpdater.autoInstallOnAppQuit = !isMac

  if (isMac) {
    autoUpdater.on('update-available', (info) => {
      win.webContents.send('updater:available', info.version)
    })
  } else {
    autoUpdater.on('update-downloaded', (info) => {
      win.webContents.send('updater:downloaded', info.version)
    })
  }

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000)

  ipcMain.on('updater:install', () => autoUpdater.quitAndInstall())
  ipcMain.on('updater:open-releases', () => shell.openExternal(RELEASES_URL))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.upkanid.ipcam')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-local-ip', () => getLocalIP())
  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.handle('restart-signaling', (_, port: number) => {
    if (!isValidPort(port)) throw new Error('Invalid signaling port')
    if (stopSignaling) stopSignaling()
    stopSignaling = createSignalingServer(port)
    return port
  })

  ipcMain.handle('virtualcam:check', () => getPlatformInfo())
  ipcMain.handle('virtualcam:recheck', () => virtualCam.recheck())

  ipcMain.on('virtualcam:arm', (event) => {
    virtualCam.arm((status) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('virtualcam:status', status, virtualCam.getInfo().reason)
      }
    })
  })

  ipcMain.on('virtualcam:disarm', () => virtualCam.disarm())

  ipcMain.on('virtualcam:frame', (event, buffer: ArrayBuffer, width: number, height: number) => {
    if (event.sender.isDestroyed()) return
    if (!Number.isInteger(width) || !Number.isInteger(height)) return
    if (width <= 0 || height <= 0 || width > 1280 || height > 1280) return
    if (buffer.byteLength !== width * height * 4 || buffer.byteLength > MAX_FRAME_BYTES) return
    virtualCam.writeFrame(Buffer.from(buffer), width, height)
  })

  ipcMain.handle('virtualmic:check', () => getVMicPlatformInfo())
  ipcMain.handle('virtualmic:recheck', () => virtualMic.recheck())

  ipcMain.on('virtualmic:arm', (event) => {
    virtualMic.arm((status) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('virtualmic:status', status, virtualMic.getInfo().reason)
      }
    })
  })

  ipcMain.on('virtualmic:disarm', () => virtualMic.disarm())

  ipcMain.on('virtualmic:audio', (event, buffer: ArrayBuffer) => {
    if (event.sender.isDestroyed()) return
    if (buffer.byteLength !== MAX_AUDIO_BYTES) return
    virtualMic.writeAudio(Buffer.from(buffer))
  })

  virtualCam = new VirtualCamera()
  virtualMic = new VirtualMic()
  stopSignaling = createSignalingServer(3717)
  const win = createWindow()
  setupAutoUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  virtualCam?.destroy()
  virtualMic?.destroy()
  if (process.platform !== 'darwin') app.quit()
})

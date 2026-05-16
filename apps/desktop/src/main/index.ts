import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { createSignalingServer, getLocalIP } from './signaling'
import { VirtualCamera, getPlatformInfo } from './virtualcam'

let stopSignaling: () => void
let virtualCam: VirtualCamera

function createWindow(): BrowserWindow {
  const iconPath = join(__dirname, '../../resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 760,
    minHeight: 520,
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
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

  ipcMain.on('virtualcam:frame', (_, buffer: ArrayBuffer, width: number, height: number) => {
    virtualCam.writeFrame(Buffer.from(buffer), width, height)
  })

  virtualCam = new VirtualCamera()
  stopSignaling = createSignalingServer(3717)
  const win = createWindow()
  setupAutoUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  virtualCam?.destroy()
  if (process.platform !== 'darwin') app.quit()
})

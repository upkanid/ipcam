import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createSignalingServer, getLocalIP } from './signaling'
import { VirtualCamera, getPlatformInfo } from './virtualcam'

let stopSignaling: () => void
let virtualCam: VirtualCamera

function createWindow(): void {
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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.upkanid.ipcam')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-local-ip', () => getLocalIP())

  ipcMain.handle('restart-signaling', (_, port: number) => {
    if (stopSignaling) stopSignaling()
    stopSignaling = createSignalingServer(port)
    return port
  })

  ipcMain.handle('virtualcam:check', () => getPlatformInfo())

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
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  virtualCam?.destroy()
  if (process.platform !== 'darwin') app.quit()
})

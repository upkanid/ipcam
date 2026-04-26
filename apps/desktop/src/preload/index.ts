import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  restartSignaling: (port: number) => ipcRenderer.invoke('restart-signaling', port),
  virtualCam: {
    check: () => ipcRenderer.invoke('virtualcam:check'),
    arm: () => ipcRenderer.send('virtualcam:arm'),
    disarm: () => ipcRenderer.send('virtualcam:disarm'),
    sendFrame: (buffer: ArrayBuffer, width: number, height: number) =>
      ipcRenderer.send('virtualcam:frame', buffer, width, height),
    onStatus: (cb: (status: string, reason: string) => void) =>
      ipcRenderer.on('virtualcam:status', (_, status, reason) => cb(status, reason)),
    offStatus: () => ipcRenderer.removeAllListeners('virtualcam:status'),
  },
})

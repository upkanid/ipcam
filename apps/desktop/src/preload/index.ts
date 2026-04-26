import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  restartSignaling: (port: number) => ipcRenderer.invoke('restart-signaling', port),
})

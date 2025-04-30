// import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcRenderer } from 'electron/renderer'

declare global {
  interface Window {
    electron: {
      ipcRenderer: IpcRenderer
    }
    api: unknown
  }
}

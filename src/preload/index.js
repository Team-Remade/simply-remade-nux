import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getBlocks: () => ipcRenderer.invoke('get-blocks'),
  getItems: () => ipcRenderer.invoke('get-items'),
  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  loadBlockModel: (blockPath) => ipcRenderer.invoke('load-block-model', blockPath),
  loadTexture: (texturePath) => ipcRenderer.invoke('load-texture', texturePath),
  createPreviewWindow: () => ipcRenderer.invoke('create-preview-window')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

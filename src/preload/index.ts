import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  startOtree: (path) => ipcRenderer.send('otree:start', path),
  startOtreePython: (path, pythonCmd) => ipcRenderer.send('otree:start-python', path, pythonCmd),
  installRequirements: (path, pythonCmd) =>
    ipcRenderer.send('otree:install-requirements', path, pythonCmd),
  checkRequirements: (path, pythonCmd) =>
    ipcRenderer.send('otree:check-requirements', path, pythonCmd),
  stopOtree: (path) => ipcRenderer.send('otree:stop', path),
  scanPythonVersions: () => ipcRenderer.invoke('otree:scan-python-versions'),
  getDocumentsPath: () => ipcRenderer.invoke('otree:get-documents-path'),

  // Listeners
  onLogs: (callback) => ipcRenderer.on('otree:logs', (_event, value) => callback(value)),
  onStatusChange: (callback) => ipcRenderer.on('otree:status', (_event, value) => callback(value)),
  onInstallStatus: (callback) =>
    ipcRenderer.on('otree:install-status', (_event, value) => callback(value)),
  onCheckStatus: (callback) =>
    ipcRenderer.on('otree:check-status', (_event, value) => callback(value)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('otree:logs')
    ipcRenderer.removeAllListeners('otree:status')
    ipcRenderer.removeAllListeners('otree:install-status')
    ipcRenderer.removeAllListeners('otree:check-status')
  }
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

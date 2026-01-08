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
  getVenvInfo: (path) => ipcRenderer.invoke('otree:get-venv-info', path),
  cleanVenv: (path) => ipcRenderer.invoke('otree:clean-venv', path),
  openUrl: (url) => ipcRenderer.send('open-url', url),

  // Python Version Management
  getPythonVersions: () => ipcRenderer.invoke('python:get-versions'),
  getAvailablePythonVersions: () => ipcRenderer.invoke('python:get-available-versions'),
  scanSystemPythons: () => ipcRenderer.invoke('python:scan-system'),
  downloadPython: (version) => ipcRenderer.send('python:download', version),
  setProjectPythonVersion: (projectHash, version) =>
    ipcRenderer.invoke('python:set-project-version', projectHash, version),
  getProjectPythonVersion: (projectHash) =>
    ipcRenderer.invoke('python:get-project-version', projectHash),
  getPythonPath: (version) => ipcRenderer.invoke('python:get-path', version),
  deletePython: (version) => ipcRenderer.invoke('python:delete', version),
  isPythonInstalled: (version) => ipcRenderer.invoke('python:is-installed', version),
  repairPython: (version) => ipcRenderer.invoke('python:repair', version),

  // Sample Project (deprecated - will be removed)
  extractSampleProject: () => ipcRenderer.invoke('sample:extract'),

  // Project Creation
  createOtreeProject: (params) => ipcRenderer.invoke('otree:create-project', params),
  validateOtreeProject: (projectPath) => ipcRenderer.invoke('otree:validate-project', projectPath),

  // Project Import
  selectOtreezipFile: () => ipcRenderer.invoke('otree:select-otreezip'),
  importOtreezip: (params) => ipcRenderer.invoke('otree:import-otreezip', params),

  // Listeners
  onLogs: (callback) => ipcRenderer.on('otree:logs', (_event, value) => callback(value)),
  onStatusChange: (callback) => ipcRenderer.on('otree:status', (_event, value) => callback(value)),
  onInstallStatus: (callback) =>
    ipcRenderer.on('otree:install-status', (_event, value) => callback(value)),
  onCheckStatus: (callback) =>
    ipcRenderer.on('otree:check-status', (_event, value) => callback(value)),
  onServerUrl: (callback) =>
    ipcRenderer.on('otree:server-url', (_event, value) => callback(value)),
  onDownloadProgress: (callback) =>
    ipcRenderer.on('python:download-progress', (_event, value) => callback(value)),
  onDownloadStatus: (callback) =>
    ipcRenderer.on('python:download-status', (_event, value) => callback(value)),
  onProjectCreationProgress: (callback) =>
    ipcRenderer.on('otree:creation-progress', (_event, value) => callback(value)),
  onImportProgress: (callback) =>
    ipcRenderer.on('otree:import-progress', (_event, value) => callback(value)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('otree:logs')
    ipcRenderer.removeAllListeners('otree:status')
    ipcRenderer.removeAllListeners('otree:install-status')
    ipcRenderer.removeAllListeners('otree:check-status')
    ipcRenderer.removeAllListeners('otree:server-url')
    ipcRenderer.removeAllListeners('python:download-progress')
    ipcRenderer.removeAllListeners('python:download-status')
    ipcRenderer.removeAllListeners('otree:creation-progress')
    ipcRenderer.removeAllListeners('otree:import-progress')
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

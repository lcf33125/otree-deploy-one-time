/// <reference types="vite/client" />

interface API {
  selectFolder: () => Promise<string | undefined>
  startOtree: (path: string) => void
  startOtreePython: (path: string, pythonCmd: string) => void
  installRequirements: (path: string, pythonCmd: string) => void
  checkRequirements: (path: string, pythonCmd: string) => void
  stopOtree: (path: string) => void
  scanPythonVersions: () => Promise<string[]>
  getDocumentsPath: () => Promise<string>
  openUrl: (url: string) => void
  onLogs: (callback: (value: string) => void) => void
  onStatusChange: (callback: (value: boolean) => void) => void
  onInstallStatus: (callback: (value: string) => void) => void
  onCheckStatus: (callback: (value: string) => void) => void
  removeAllListeners: () => void
}

declare global {
  interface Window {
    api: API
  }
}

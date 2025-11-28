import React, { useState, useEffect } from 'react'
import LogViewer from './components/LogViewer'
import SettingsModal from './components/SettingsModal'

// 1. Define the shape of the API exposed from preload.js
interface IElectronAPI {
  selectFolder: () => Promise<string>
  startOtree: (path: string) => void
  startOtreePython: (path: string, pythonCmd: string) => void
  installRequirements: (path: string, pythonCmd: string) => void
  checkRequirements: (path: string, pythonCmd: string) => void
  stopOtree: (path: string) => void
  scanPythonVersions: () => Promise<{ version: string; path: string }[]>
  getDocumentsPath: () => Promise<string>
  onLogs: (callback: (log: string) => void) => void
  onStatusChange: (callback: (status: string) => void) => void
  onInstallStatus: (callback: (status: string) => void) => void
  onCheckStatus: (callback: (isInstalled: boolean) => void) => void
  removeAllListeners: () => void
}

// 2. Extend the global Window interface to include our API
declare global {
  interface Window {
    api: IElectronAPI
  }
}

interface Settings {
  autoCopyLogs: boolean
  defaultProjectPath: string
  pythonCommand: string
}

const DEFAULT_SETTINGS: Settings = {
  autoCopyLogs: true,
  defaultProjectPath: '',
  pythonCommand: 'python'
}

const App: React.FC = () => {
  // 3. Add Types to State
  const [projectPath, setProjectPath] = useState<string>('')

  // valid status strings
  const [status, setStatus] = useState<'stopped' | 'running'>('stopped')
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>(
    'idle'
  )

  const [logs, setLogs] = useState<string[]>([])

  // Settings State
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('otree-launcher-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })

        // Apply default project path if set
        if (parsed.defaultProjectPath) {
          setProjectPath(parsed.defaultProjectPath)
          window.api.checkRequirements(parsed.defaultProjectPath, parsed.pythonCommand || 'python')
        }
      } catch (e) {
        console.error('Failed to parse settings', e)
      }
    }
  }, [])

  const handleSaveSettings = (newSettings: Settings): void => {
    setSettings(newSettings)
    localStorage.setItem('otree-launcher-settings', JSON.stringify(newSettings))

    // If project path changed via settings and we don't have one selected (or it matches the old default), update it
    if (
      newSettings.defaultProjectPath &&
      (!projectPath || projectPath === settings.defaultProjectPath)
    ) {
      setProjectPath(newSettings.defaultProjectPath)
      window.api.checkRequirements(newSettings.defaultProjectPath, newSettings.pythonCommand)
    }
  }

  useEffect(() => {
    // Listen for Logs
    window.api.onLogs((newLog: string) => {
      setLogs((prev) => [...prev, newLog])
    })

    // Listen for Status Changes
    window.api.onStatusChange((newStatus: string) => {
      // Cast the string from backend to our union type
      setStatus(newStatus as 'stopped' | 'running')
    })

    window.api.onInstallStatus((newStatus: string) => {
      setInstallStatus(newStatus as 'idle' | 'installing' | 'success' | 'error')
    })

    window.api.onCheckStatus((isInstalled: boolean) => {
      if (isInstalled) {
        setInstallStatus('success')
        setLogs((prev) => [...prev, '[SYSTEM] Environment already configured (otree found).\n'])
      } else {
        setInstallStatus('idle')
      }
    })

    return () => window.api.removeAllListeners()
  }, [])

  const handleSelectFolder = async (): Promise<void> => {
    const path = await window.api.selectFolder()
    if (path) {
      setProjectPath(path)
      setInstallStatus('idle') // Reset first
      window.api.checkRequirements(path, settings.pythonCommand) // Check if already installed
    }
  }

  const handleInstall = (): void => {
    if (!projectPath) return
    setInstallStatus('installing')
    window.api.installRequirements(projectPath, settings.pythonCommand)
  }

  const handleStart = (): void => {
    if (!projectPath) {
      alert('Please select a folder first')
      return
    }
    setLogs([]) // Clear logs
    window.api.startOtreePython(projectPath, settings.pythonCommand)
  }

  const handleStop = (): void => {
    window.api.stopOtree(projectPath)
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Left Panel: Controls */}
      <div className="w-full md:w-[450px] flex flex-col border-r border-border bg-card/30 p-6 space-y-8 overflow-y-auto shrink-0">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight">oTree Launcher</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <div className="h-6 w-px bg-border mx-1"></div>
            <span
              className={`text-xs font-bold tracking-wider ${status === 'running' ? 'text-green-500' : 'text-red-500'}`}
            >
              {status.toUpperCase()}
            </span>
            <div
              className={`w-3 h-3 rounded-full ${status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            ></div>
          </div>
        </div>

        {/* Section 1: Project Selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            1. Project Selection
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
              <span className="text-sm truncate font-mono" title={projectPath}>
                {projectPath
                  ? projectPath.length > 30
                    ? '...' + projectPath.slice(-30)
                    : projectPath
                  : 'No folder selected'}
              </span>
            </div>
            <button
              onClick={handleSelectFolder}
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Change Folder
            </button>
          </div>
        </div>

        {/* Section 2: Environment Setup */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            2. Environment Setup
          </h2>
          <div className="bg-card border border-border rounded-lg p-4">
            <button
              onClick={handleInstall}
              disabled={!projectPath || installStatus === 'installing' || status === 'running'}
              className={`w-full h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                installStatus === 'success'
                  ? 'bg-green-600/20 text-green-500 border border-green-600/50 cursor-default'
                  : installStatus === 'installing'
                    ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 cursor-wait'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {installStatus === 'installing' ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Installing...
                </>
              ) : installStatus === 'success' ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Requirements Installed
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  Install Requirements (pip)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 3: Server Control */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            3. Server Control
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
            <button
              onClick={handleStart}
              disabled={!projectPath || installStatus === 'installing' || status === 'running'}
              className={`flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                status === 'running'
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Server
            </button>

            <button
              onClick={handleStop}
              disabled={status === 'stopped'}
              className={`flex-1 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                status === 'stopped'
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              Stop Server
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Logs */}
      <div className="flex-1 flex flex-col min-w-0 bg-black border-l border-border">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/20">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Logs
          </h2>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 p-4">
            <LogViewer logs={logs} autoCopy={settings.autoCopyLogs} />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App

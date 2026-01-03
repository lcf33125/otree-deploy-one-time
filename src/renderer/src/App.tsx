import React, { useState, useEffect } from 'react'
import LogViewer from './components/LogViewer'
import SettingsModal from './components/SettingsModal'
import PythonVersionManager from './components/PythonVersionManager'
import WelcomeWizard from './components/WelcomeWizard'

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
  getVenvInfo: (path: string) => Promise<{ venvDir: string; exists: boolean; venvBaseDir: string }>
  cleanVenv: (path: string) => Promise<{ success: boolean; message: string }>
  openUrl: (url: string) => void
  // Python Version Management
  getPythonVersions: () => Promise<{
    managed: Array<{ version: string; path: string; source: string; downloadDate?: string }>
    system: Array<{ version: string; path: string; source: string; downloadDate?: string }>
  }>
  getAvailablePythonVersions: () => Promise<string[]>
  scanSystemPythons: () => Promise<
    Array<{ version: string; path: string; source: string; downloadDate?: string }>
  >
  downloadPython: (version: string) => void
  setProjectPythonVersion: (projectHash: string, version: string) => Promise<{ success: boolean }>
  getProjectPythonVersion: (projectHash: string) => Promise<string | null>
  getPythonPath: (version: string) => Promise<string | null>
  deletePython: (version: string) => Promise<{ success: boolean; error?: string }>
  isPythonInstalled: (version: string) => Promise<boolean>
  repairPython: (version: string) => Promise<{ success: boolean; error?: string }>
  // Sample Project
  extractSampleProject: () => Promise<{
    success: boolean
    path?: string
    message?: string
    error?: string
  }>
  // Listeners
  onLogs: (callback: (log: string) => void) => void
  onStatusChange: (callback: (status: string) => void) => void
  onInstallStatus: (callback: (status: string) => void) => void
  onCheckStatus: (callback: (isInstalled: boolean) => void) => void
  onServerUrl: (callback: (url: string) => void) => void
  onDownloadProgress: (callback: (data: { version: string; progress: number }) => void) => void
  onDownloadStatus: (
    callback: (data: {
      version: string
      status: string
      path?: string
      error?: string
    }) => void
  ) => void
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
  const [venvInfo, setVenvInfo] = useState<{ venvDir: string; exists: boolean } | null>(null)

  // Settings State
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showPythonManager, setShowPythonManager] = useState(false)
  const [currentPythonVersion, setCurrentPythonVersion] = useState<string | null>(null)
  const [hasScannedPython, setHasScannedPython] = useState(false)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [showWelcomeWizard, setShowWelcomeWizard] = useState(false)

  // Check if this is the first launch
  useEffect(() => {
    const hasCompletedWelcome = localStorage.getItem('otree-launcher-welcome-completed')
    if (!hasCompletedWelcome) {
      setShowWelcomeWizard(true)
    }
  }, [])

  // Auto-scan for Python versions on first load
  useEffect(() => {
    const initPython = async () => {
      if (!hasScannedPython) {
        try {
          await window.api.scanSystemPythons()
          setHasScannedPython(true)
          
          // Get current Python version if using system python command
          if (settings.pythonCommand === 'python' || settings.pythonCommand.includes('python')) {
            // This will be detected by the system scan
            const versions = await window.api.getPythonVersions()
            if (versions.managed.length === 0 && versions.system.length === 0) {
              // No Python found, auto-show manager
              setShowPythonManager(true)
            }
          }
        } catch (error) {
          console.error('Failed to scan Python versions:', error)
        }
      }
    }
    initPython()
  }, [hasScannedPython, settings.pythonCommand])

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
      // Clear server URL when stopped
      if (newStatus === 'stopped') {
        setServerUrl(null)
      }
    })

    // Listen for Server URL
    window.api.onServerUrl((url: string) => {
      setServerUrl(url)
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

  // Load venv info when project path changes
  useEffect(() => {
    if (projectPath) {
      window.api.getVenvInfo(projectPath).then(setVenvInfo)
    } else {
      setVenvInfo(null)
    }
  }, [projectPath, installStatus]) // Also reload when install status changes

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

  const handleCleanVenv = async (): Promise<void> => {
    if (!projectPath) return
    
    if (confirm('Are you sure you want to remove the virtual environment? You will need to reinstall dependencies.')) {
      const result = await window.api.cleanVenv(projectPath)
      if (result.success) {
        setInstallStatus('idle')
        setLogs((prev) => [...prev, `[SYSTEM] ${result.message}\n`])
        // Refresh venv info
        window.api.getVenvInfo(projectPath).then(setVenvInfo)
      } else {
        setLogs((prev) => [...prev, `[SYSTEM] Failed to clean venv: ${result.message}\n`])
      }
    }
  }

  const handleStart = (): void => {
    if (!projectPath) {
      alert('Please select a folder first')
      return
    }
    setLogs([]) // Clear logs
    setServerUrl(null) // Clear previous server URL
    window.api.startOtreePython(projectPath, settings.pythonCommand)
  }

  const handleStop = (): void => {
    window.api.stopOtree(projectPath)
  }

  // Helper function to compute project hash (simple browser-compatible version)
  const getProjectHash = (path: string): string => {
    // Simple hash function for browser compatibility
    let hash = 0
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8)
  }

  // Handle Python version selection
  const handlePythonVersionSelect = (version: string, pythonPath: string): void => {
    setSettings({ ...settings, pythonCommand: pythonPath })
    setCurrentPythonVersion(version)
    localStorage.setItem(
      'otree-launcher-settings',
      JSON.stringify({ ...settings, pythonCommand: pythonPath })
    )
    setLogs((prev) => [
      ...prev,
      `[SYSTEM] Selected Python ${version} at ${pythonPath}\n`
    ])
  }

  // Handle Welcome Wizard completion
  const handleWelcomeComplete = (config: {
    projectPath?: string
    pythonVersion?: string
    pythonPath?: string
  }): void => {
    // Mark welcome as completed
    localStorage.setItem('otree-launcher-welcome-completed', 'true')
    setShowWelcomeWizard(false)

    // Apply configuration from wizard
    if (config.pythonPath && config.pythonVersion) {
      handlePythonVersionSelect(config.pythonVersion, config.pythonPath)
    }

    if (config.projectPath) {
      setProjectPath(config.projectPath)
      setInstallStatus('idle')
      window.api.checkRequirements(config.projectPath, config.pythonPath || settings.pythonCommand)
    }

    // Log completion
    setLogs((prev) => [
      ...prev,
      '[SYSTEM] Welcome wizard completed! You can now start using oTree Launcher.\n'
    ])
  }

  // Handle Welcome Wizard skip
  const handleWelcomeSkip = (): void => {
    localStorage.setItem('otree-launcher-welcome-completed', 'true')
    setShowWelcomeWizard(false)
    setLogs((prev) => [
      ...prev,
      '[SYSTEM] Welcome wizard skipped. You can access features from the main interface.\n'
    ])
  }

  // Handle Welcome Wizard reset
  const handleResetWizard = (): void => {
    localStorage.removeItem('otree-launcher-welcome-completed')
    setShowWelcomeWizard(true)
    setLogs((prev) => [
      ...prev,
      '[SYSTEM] Welcome wizard restarted.\n'
    ])
  }

  return (
    <>
      {/* Welcome Wizard */}
      {showWelcomeWizard && (
        <WelcomeWizard onComplete={handleWelcomeComplete} onSkip={handleWelcomeSkip} />
      )}

      <div className="flex flex-col md:flex-row h-screen bg-background text-foreground overflow-hidden font-sans">
        {/* Left Panel: Controls */}
      <div className="w-full md:w-[450px] flex flex-col border-r border-border bg-card/30 p-6 space-y-8 overflow-y-auto shrink-0">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight">oTree Launcher</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetWizard}
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Help - Re-run Welcome Wizard"
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
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </button>
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
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
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

            {/* Python Version Info */}
            <div className="bg-secondary/50 border border-border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Python Version</span>
                <button
                  onClick={() => setShowPythonManager(!showPythonManager)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showPythonManager ? 'Hide Manager' : 'Manage Versions'}
                </button>
              </div>
              <div className="flex items-start gap-2">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${currentPythonVersion ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-foreground/80 break-all">
                    {currentPythonVersion ? `Python ${currentPythonVersion}` : 'Using system default Python'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPythonVersion 
                      ? 'Selected from managed versions' 
                      : 'Click "Manage Versions" to select a specific version'}
                  </p>
                </div>
              </div>
            </div>

            {/* Virtual Environment Info */}
            {venvInfo && (
              <div className="bg-secondary/50 border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Virtual Environment</span>
                  {venvInfo.exists && (
                    <button
                      onClick={handleCleanVenv}
                      disabled={status === 'running' || installStatus === 'installing'}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove virtual environment"
                    >
                      Clean
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${venvInfo.exists ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-foreground/80 break-all">
                      {venvInfo.venvDir}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {venvInfo.exists ? 'Exists' : 'Not created yet'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2b: Python Version Management (Conditional) */}
        {showPythonManager && projectPath && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                🐍 Python Version Management
              </h2>
              <button
                onClick={() => setShowPythonManager(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-card border border-border rounded-lg p-2 max-h-[500px] overflow-y-auto">
              <PythonVersionManager
                projectHash={getProjectHash(projectPath)}
                onVersionSelect={handlePythonVersionSelect}
              />
            </div>
          </div>
        )}

        {/* Section 3: Server Control */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            3. Server Control
          </h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
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

            {/* Open in Browser Button - Shows when server URL is available */}
            {serverUrl && (
              <button
                onClick={() => window.api.openUrl(serverUrl)}
                className="w-full h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white animate-pulse"
              >
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Open in Browser ({serverUrl})
              </button>
            )}
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
        onResetWizard={handleResetWizard}
      />
    </div>
    </>
  )
}

export default App

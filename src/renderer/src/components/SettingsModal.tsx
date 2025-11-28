import React from 'react'

interface Settings {
  autoCopyLogs: boolean
  defaultProjectPath: string
  pythonCommand: string
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  onSave: (newSettings: Settings) => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}): React.ReactElement | null => {
  const [localSettings, setLocalSettings] = React.useState<Settings>(settings)
  const [pythonVersions, setPythonVersions] = React.useState<{ version: string; path: string }[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = React.useState(false)

  // Reset local state when modal opens
  React.useEffect(() => {
    setLocalSettings(settings)
    if (isOpen) {
      loadPythonVersions()
    }
  }, [settings, isOpen])

  const loadPythonVersions = async (): Promise<void> => {
    setIsLoadingVersions(true)
    try {
      const versions = await window.api.scanPythonVersions()
      setPythonVersions(versions)
    } catch (e) {
      console.error('Failed to scan python versions', e)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const handleBrowse = async (): Promise<void> => {
    const path = await window.api.selectFolder()
    if (path) {
      setLocalSettings({ ...localSettings, defaultProjectPath: path })
    }
  }

  if (!isOpen) return null

  const handleSave = (): void => {
    onSave(localSettings)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto Copy Logs */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-foreground">Auto-copy Logs</label>
              <p className="text-xs text-muted-foreground">
                Automatically copy selected text in logs to clipboard
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.autoCopyLogs}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, autoCopyLogs: e.target.checked })
              }
              className="h-4 w-4 rounded border-border bg-secondary text-primary focus:ring-ring"
            />
          </div>

          {/* Default Project Path */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Default Project Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={localSettings.defaultProjectPath}
                placeholder="Select a folder..."
                className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-not-allowed opacity-75"
              />
              <button
                onClick={handleBrowse}
                className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 border border-border"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              The app will default to this folder on startup.
            </p>
          </div>

          {/* Python Command */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Python Version</label>
            {isLoadingVersions ? (
              <div className="text-sm text-muted-foreground animate-pulse">Scanning Python versions...</div>
            ) : (
              <select
                value={localSettings.pythonCommand}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, pythonCommand: e.target.value })
                }
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {pythonVersions.map((v) => (
                  <option key={v.path} value={v.path}>
                    {v.version}
                  </option>
                ))}
                {/* Fallback if list is empty or custom needed */}
                {pythonVersions.length === 0 && <option value="python">System Default (python)</option>}
              </select>
            )}
            <p className="text-xs text-muted-foreground">
              Select the Python interpreter to use for creating virtual environments.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal

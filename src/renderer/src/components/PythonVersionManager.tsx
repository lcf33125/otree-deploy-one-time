import React, { useState, useEffect } from 'react'

interface PythonVersion {
  version: string
  path: string
  source: string
  downloadDate?: string
}

interface Props {
  projectHash: string
  onVersionSelect: (version: string, pythonPath: string) => void
}

const PythonVersionManager: React.FC<Props> = ({ projectHash, onVersionSelect }) => {
  const [pythons, setPythons] = useState<{ managed: PythonVersion[]; system: PythonVersion[] }>({
    managed: [],
    system: []
  })
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [availableVersions, setAvailableVersions] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    loadPythonVersions()
    loadProjectPreference()
    loadAvailableVersions()

    // Set up listeners
    window.api.onDownloadProgress(({ version, progress }) => {
      if (version === downloadingVersion) {
        setDownloadProgress(progress)
      }
    })

    window.api.onDownloadStatus(({ version, status, path, error }) => {
      if (status === 'complete') {
        setDownloadingVersion(null)
        setDownloadProgress(0)
        loadPythonVersions()
        if (path) {
          handleSelect(version, path)
        }
      } else if (status === 'error') {
        setDownloadingVersion(null)
        setDownloadProgress(0)
        alert(`Failed to download Python ${version}: ${error}`)
      }
    })
  }, [])

  const loadPythonVersions = async () => {
    const versions = await window.api.getPythonVersions()
    setPythons(versions)
  }

  const loadProjectPreference = async () => {
    const preferred = await window.api.getProjectPythonVersion(projectHash)
    if (preferred) {
      setSelectedVersion(preferred)
    }
  }

  const loadAvailableVersions = async () => {
    const versions = await window.api.getAvailablePythonVersions()
    setAvailableVersions(versions)
  }

  const handleScanSystem = async () => {
    setIsScanning(true)
    try {
      await window.api.scanSystemPythons()
      await loadPythonVersions()
    } catch (error) {
      console.error('Error scanning system:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleDownload = (version: string) => {
    setDownloadingVersion(version)
    setDownloadProgress(0)
    window.api.downloadPython(version)
  }

  const handleSelect = async (version: string, pythonPath: string) => {
    setSelectedVersion(version)
    await window.api.setProjectPythonVersion(projectHash, version)
    onVersionSelect(version, pythonPath)
  }

  const handleDelete = async (version: string) => {
    if (confirm(`Are you sure you want to delete Python ${version}?`)) {
      const result = await window.api.deletePython(version)
      if (result.success) {
        await loadPythonVersions()
        if (selectedVersion === version) {
          setSelectedVersion(null)
        }
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    }
  }

  const handleRepair = async (version: string) => {
    if (confirm(`This will reinstall virtualenv for Python ${version}. Continue?`)) {
      const result = await window.api.repairPython(version)
      if (result.success) {
        alert(`Python ${version} repaired successfully! You can now create virtual environments.`)
      } else {
        alert(`Failed to repair: ${result.error}`)
      }
    }
  }

  const allPythons = [
    ...pythons.managed.map((p) => ({ ...p, source: 'managed' as const })),
    ...pythons.system.map((p) => ({ ...p, source: 'system' as const }))
  ]

  const installedVersions = new Set(allPythons.map((p) => p.version))

  // Determine oTree compatibility
  const isOtreeCompatible = (version: string): boolean => {
    const major = parseInt(version.split('.')[0])
    const minor = parseInt(version.split('.')[1])
    return major === 3 && minor >= 7 && minor <= 11
  }

  return (
    <div className="python-version-manager">
      <h3>🐍 Python Version Management</h3>

      {/* Quick Start Section for new users */}
      {allPythons.length === 0 && (
        <div className="section" style={{ background: 'rgba(66, 185, 131, 0.1)', borderColor: 'rgba(66, 185, 131, 0.3)' }}>
          <h4>🚀 Quick Start</h4>
          <p className="info-text">
            No Python installations detected. Download Python 3.11.9 (recommended for oTree) to get started.
          </p>
          <button
            onClick={() => handleDownload('3.11.9')}
            disabled={downloadingVersion === '3.11.9'}
            className="download-btn"
            style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
          >
            {downloadingVersion === '3.11.9' ? (
              <>⏳ Downloading Python 3.11.9...</>
            ) : (
              <>⬇ Download Python 3.11.9 (Recommended)</>
            )}
          </button>
          <p className="info-text" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Or click "🔍 Scan System" below if you already have Python installed.
          </p>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h4>Installed Python Versions</h4>
          <button onClick={handleScanSystem} disabled={isScanning} className="scan-button">
            {isScanning ? '🔄 Scanning...' : '🔍 Scan System'}
          </button>
        </div>

        {allPythons.length === 0 ? (
          <div className="empty-state">
            <p>No Python installations found.</p>
            <p className="hint">Download a managed version below or scan your system.</p>
          </div>
        ) : (
          <div className="python-list">
            {allPythons.map((python) => (
              <div
                key={python.path}
                className={`python-item ${selectedVersion === python.version ? 'selected' : ''}`}
              >
                <div className="python-info">
                  <div className="python-header">
                    <strong>Python {python.version}</strong>
                    <div className="badges">
                      <span className={`source-badge source-${python.source}`}>
                        {python.source === 'managed' ? '📦 Managed' : '💻 System'}
                      </span>
                      {isOtreeCompatible(python.version) && (
                        <span className="compatible-badge">✓ oTree</span>
                      )}
                    </div>
                  </div>
                  <code className="python-path">{python.path}</code>
                </div>
                <div className="python-actions">
                  <button
                    onClick={() => handleSelect(python.version, python.path)}
                    disabled={selectedVersion === python.version}
                    className="select-button"
                  >
                    {selectedVersion === python.version ? '✓ Selected' : 'Select'}
                  </button>
                  {python.source === 'managed' && (
                    <>
                      <button
                        onClick={() => handleRepair(python.version)}
                        className="repair-button"
                        title="Reinstall virtualenv"
                      >
                        🔧
                      </button>
                      <button
                        onClick={() => handleDelete(python.version)}
                        className="delete-button"
                        disabled={selectedVersion === python.version}
                        title="Delete this Python installation"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h4>Download Python Version</h4>
        <p className="info-text">
          Download and install Python versions managed by this app. These installations are shared
          across all your oTree projects.
        </p>

        <div className="download-grid">
          {availableVersions.map((version) => {
            const isInstalled = installedVersions.has(version)
            const isDownloading = downloadingVersion === version
            const isCompatible = isOtreeCompatible(version)
            const isRecommended = version === '3.11.9'

            return (
              <div 
                key={version} 
                className={`download-card ${isCompatible ? 'compatible' : ''} ${isRecommended ? 'recommended' : ''}`}
              >
                <div className="version-header">
                  <strong>Python {version}</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {isRecommended && <span className="recommended-badge">⭐ Recommended</span>}
                    {isCompatible && <span className="compatible-badge">✓ oTree</span>}
                    {!isCompatible && (
                      <span className="incompatible-badge" title="Not compatible with most oTree versions">
                        ⚠️ Limited
                      </span>
                    )}
                  </div>
                </div>

                {isInstalled ? (
                  <button disabled className="installed-btn">
                    ✓ Installed
                  </button>
                ) : isDownloading ? (
                  <div className="download-progress-container">
                    <div className="progress-bar-bg">
                      <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
                    </div>
                    <span className="progress-text">{Math.round(downloadProgress)}%</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleDownload(version)} 
                    className={`download-btn ${isRecommended ? 'recommended-btn' : ''}`}
                  >
                    ⬇ Download (~30 MB)
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="section info-section">
        <h4>ℹ️ About Python Versions</h4>
        <ul>
          <li>
            <strong>oTree Compatible:</strong> Python 3.7-3.11 are officially supported by most
            oTree versions
          </li>
          <li>
            <strong>Managed Versions:</strong> Downloaded and managed by this app, stored in your
            app data folder
          </li>
          <li>
            <strong>System Versions:</strong> Detected from your Windows installation
          </li>
          <li>
            <strong>Recommendation:</strong> Use Python 3.11 for the best compatibility with recent
            oTree versions
          </li>
        </ul>
      </div>
    </div>
  )
}

export default PythonVersionManager

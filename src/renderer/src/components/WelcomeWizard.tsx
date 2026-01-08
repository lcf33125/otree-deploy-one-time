import React, { useState, useEffect } from 'react'

interface WelcomeWizardProps {
  onComplete: (config: {
    projectPath?: string
    pythonVersion?: string
    pythonPath?: string
  }) => void
  onSkip: () => void
}

type WizardStep = 'welcome' | 'python' | 'project' | 'complete'
type ProjectSetupOption = 'create' | 'open' | 'import' | 'skip'

const WelcomeWizard: React.FC<WelcomeWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [pythonVersions, setPythonVersions] = useState<Array<{ version: string; path: string }>>([])
  const [selectedPython, setSelectedPython] = useState<{ version: string; path: string } | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  // Project setup state
  const [projectSetupOption, setProjectSetupOption] = useState<ProjectSetupOption | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [includeSamples, setIncludeSamples] = useState(true)
  const [existingProjectPath, setExistingProjectPath] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isValidatingProject, setIsValidatingProject] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [createdProjectPath, setCreatedProjectPath] = useState('')
  const [creationProgress, setCreationProgress] = useState({ percent: 0, status: '' })

  // Import state
  const [otreezipPath, setOtreezipPath] = useState('')
  const [extractLocation, setExtractLocation] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ percent: 0, status: '' })

  // Auto-scan for Python when reaching the Python step
  useEffect(() => {
    if (currentStep === 'python' && pythonVersions.length === 0 && !isScanning) {
      scanPython()
    }
  }, [currentStep])

  // Set default project location when component mounts
  useEffect(() => {
    const getDefaultLocation = async () => {
      try {
        const documentsPath = await window.api.getDocumentsPath()
        setProjectLocation(documentsPath)
        setExtractLocation(documentsPath) // Also set for import
      } catch (error) {
        console.error('Failed to get documents path:', error)
      }
    }
    getDefaultLocation()
  }, [])

  // Listen for project creation progress
  useEffect(() => {
    const handleProgress = (data: { percent: number; status: string; projectName: string }) => {
      setCreationProgress({ percent: data.percent, status: data.status })
    }

    window.api.onProjectCreationProgress(handleProgress)

    return () => {
      // Cleanup listener
    }
  }, [])

  // Listen for import progress
  useEffect(() => {
    const handleImportProgress = (data: { percent: number; status: string }) => {
      setImportProgress({ percent: data.percent, status: data.status })
    }

    window.api.onImportProgress(handleImportProgress)

    return () => {
      // Cleanup listener
    }
  }, [])

  const scanPython = async () => {
    setIsScanning(true)
    try {
      await window.api.scanSystemPythons()
      const versions = await window.api.getPythonVersions()
      const allVersions = [...versions.managed, ...versions.system]
      setPythonVersions(allVersions)

      // Auto-select first Python if available
      if (allVersions.length > 0) {
        setSelectedPython(allVersions[0])
      }
    } catch (error) {
      console.error('Failed to scan Python versions:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleBrowseProjectLocation = async () => {
    try {
      const result = await window.api.selectFolder()
      if (result && result.length > 0) {
        setProjectLocation(result[0])
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  const handleBrowseExistingProject = async () => {
    try {
      const result = await window.api.selectFolder()
      if (result && result.length > 0) {
        const selectedPath = result[0]
        setExistingProjectPath(selectedPath)
        await validateProject(selectedPath)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
      setValidationMessage('✗ Failed to open folder browser')
    }
  }

  const validateProject = async (projectPath: string) => {
    if (!projectPath) {
      setValidationMessage('')
      return
    }

    console.log('[Frontend] Validating project path:', projectPath)

    // Clear previous message
    setValidationMessage('')
    setIsValidatingProject(true)

    try {
      const result = await window.api.validateOtreeProject(projectPath)
      console.log('[Frontend] Validation result:', result)

      if (result.success && result.isValid) {
        setValidationMessage('✓ Valid oTree project')
      } else {
        setValidationMessage(`✗ ${result.message || result.error || 'Not a valid oTree project'}`)
      }
    } catch (error) {
      console.error('Validation error:', error)
      setValidationMessage('✗ Failed to validate project')
    } finally {
      setIsValidatingProject(false)
    }
  }

  // Add handler for manual path validation
  const handleValidateManualPath = async () => {
    if (existingProjectPath && existingProjectPath.trim()) {
      await validateProject(existingProjectPath.trim())
    }
  }

  const handleCreateProject = async () => {
    if (!projectName || !projectLocation || !selectedPython) {
      alert('Please fill in all required fields')
      return
    }

    setIsCreatingProject(true)
    setCreationProgress({ percent: 0, status: 'Starting...' })

    try {
      const result = await window.api.createOtreeProject({
        projectName,
        targetPath: projectLocation,
        pythonPath: selectedPython.path,
        includeSamples
      })

      if (result.success && result.projectPath) {
        setCreatedProjectPath(result.projectPath)
        setCurrentStep('complete')
      } else {
        alert(result.error || 'Failed to create project')
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('An error occurred while creating the project')
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleOpenExistingProject = async () => {
    if (!existingProjectPath) {
      alert('Please select a project folder')
      return
    }

    // Validate one more time before proceeding
    const result = await window.api.validateOtreeProject(existingProjectPath)

    if (result.success && result.isValid) {
      setCreatedProjectPath(existingProjectPath)
      setCurrentStep('complete')
    } else {
      alert(result.message || 'Not a valid oTree project')
    }
  }

  const handleBrowseOtreezip = async () => {
    try {
      const result = await window.api.selectOtreezipFile()
      if (result && result.length > 0) {
        setOtreezipPath(result[0])
      }
    } catch (error) {
      console.error('Failed to select .otreezip file:', error)
    }
  }

  const handleBrowseExtractLocation = async () => {
    try {
      const result = await window.api.selectFolder()
      if (result && result.length > 0) {
        setExtractLocation(result[0])
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  const handleImportOtreezip = async () => {
    if (!otreezipPath || !extractLocation) {
      alert('Please select both .otreezip file and extraction location')
      return
    }

    setIsImporting(true)
    setImportProgress({ percent: 0, status: 'Starting import...' })

    try {
      const result = await window.api.importOtreezip({
        otreezipPath,
        targetPath: extractLocation
      })

      if (result.success && result.projectPath) {
        setCreatedProjectPath(result.projectPath)

        // Alert user about required Python version if detected
        if (result.requiredPythonVersion) {
          const message = `This project requires Python ${result.requiredPythonVersion}.\n\nCurrent selected Python: ${selectedPython?.version || 'None'}\n\nPlease make sure you have Python ${result.requiredPythonVersion} installed and selected before installing requirements.`
          alert(message)
        }

        setCurrentStep('complete')
      } else {
        alert(result.error || 'Failed to import project')
      }
    } catch (error) {
      console.error('Failed to import .otreezip:', error)
      alert('An error occurred while importing the project')
    } finally {
      setIsImporting(false)
    }
  }

  const handleComplete = () => {
    const config: {
      projectPath?: string
      pythonVersion?: string
      pythonPath?: string
    } = {}

    if (createdProjectPath) {
      config.projectPath = createdProjectPath
    }

    if (selectedPython) {
      config.pythonVersion = selectedPython.version
      config.pythonPath = selectedPython.path
    }

    onComplete(config)
  }

  const renderWelcomeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold">Welcome to oTree Launcher!</h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Get started with oTree in just a few simple steps. We'll help you set up Python and create your first experiment.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">What you'll do:</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-medium">Check Python Installation</p>
              <p className="text-sm text-muted-foreground">We'll scan your system for Python or help you install it</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-medium">Set Up Your Project</p>
              <p className="text-sm text-muted-foreground">Create new, open existing, or skip for later</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-medium">Start Experimenting!</p>
              <p className="text-sm text-muted-foreground">Install dependencies and launch your oTree project</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('python')}
          className="flex-1 h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          Get Started
        </button>
        <button
          onClick={onSkip}
          className="px-6 h-12 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        This wizard will only show once. You can access these features anytime from the main interface.
      </p>
    </div>
  )

  const renderPythonStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Python Setup</h2>
        <p className="text-muted-foreground">
          oTree requires Python to run. Let's check if you have Python installed.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Detected Python Versions</h3>
          <button
            onClick={scanPython}
            disabled={isScanning}
            className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning ? 'Scanning...' : 'Rescan'}
          </button>
        </div>

        {isScanning ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <svg
                className="animate-spin h-5 w-5"
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
              Scanning for Python installations...
            </div>
          </div>
        ) : pythonVersions.length > 0 ? (
          <div className="space-y-2">
            {pythonVersions.map((py) => (
              <button
                key={py.path}
                onClick={() => setSelectedPython(py)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedPython?.path === py.path
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-border hover:border-blue-500/50 hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedPython?.path === py.path
                      ? 'border-blue-500'
                      : 'border-muted-foreground'
                  }`}>
                    {selectedPython?.path === py.path && (
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Python {py.version}</p>
                    <p className="text-xs text-muted-foreground truncate">{py.path}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 mx-auto flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-yellow-500"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <div>
              <p className="font-medium">No Python installation detected</p>
              <p className="text-sm text-muted-foreground mt-1">
                We recommend downloading Python 3.11 for the best compatibility with oTree
              </p>
            </div>
            <button
              onClick={() => window.api.openUrl('https://www.python.org/downloads/')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Download Python 3.11
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('welcome')}
          className="px-6 h-12 rounded-md border border-border hover:bg-secondary transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('project')}
          disabled={pythonVersions.length === 0}
          className="flex-1 h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
        >
          {pythonVersions.length === 0 ? 'Install Python First' : 'Continue'}
        </button>
      </div>
    </div>
  )

  const renderProjectStep = () => {
    if (!projectSetupOption) {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Project Setup</h2>
            <p className="text-muted-foreground">
              How would you like to set up your oTree project?
            </p>
          </div>

          <div className="space-y-3">
            {/* Option 1: Create New Project */}
            <button
              onClick={() => setProjectSetupOption('create')}
              className="w-full text-left p-5 rounded-lg border border-border hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/30 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Create New Project</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use <code className="text-xs bg-secondary px-1 py-0.5 rounded">otree startproject</code> to create a new oTree project with optional sample apps
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Open Existing Project */}
            <button
              onClick={() => setProjectSetupOption('open')}
              className="w-full text-left p-5 rounded-lg border border-border hover:border-purple-500 hover:bg-purple-500/5 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-400"
                  >
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Open Existing Project</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Browse to an existing oTree project folder on your computer
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Import from oTreeHub */}
            <button
              onClick={() => setProjectSetupOption('import')}
              className="w-full text-left p-5 rounded-lg border border-border hover:border-green-500 hover:bg-green-500/5 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0 group-hover:bg-green-500/30 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-green-400"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Import from oTreeHub</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import a project from an <code className="text-xs bg-secondary px-1 py-0.5 rounded">.otreezip</code> file downloaded from oTreeHub
                  </p>
                </div>
              </div>
            </button>

            {/* Option 4: Skip */}
            <button
              onClick={() => {
                setProjectSetupOption('skip')
                setCurrentStep('complete')
              }}
              className="w-full text-left p-5 rounded-lg border border-border hover:border-gray-500 hover:bg-secondary/50 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-500/20 flex items-center justify-center shrink-0 group-hover:bg-gray-500/30 transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-400"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Skip for Now</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    I'll set up my project later from the main interface
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentStep('python')}
              className="flex-1 h-12 px-6 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )
    }

    // Create New Project Sub-interface
    if (projectSetupOption === 'create') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Create New Project</h2>
            <p className="text-muted-foreground">
              Configure your new oTree project settings
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., my_experiment"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers, and underscores only
              </p>
            </div>

            {/* Project Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleBrowseProjectLocation}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
                >
                  Browse
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Project will be created at: {projectLocation}/{projectName}
              </p>
            </div>

            {/* Include Samples */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <div className="space-y-2">
                <button
                  onClick={() => setIncludeSamples(true)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    includeSamples
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-border hover:border-blue-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      includeSamples ? 'border-blue-500' : 'border-muted-foreground'
                    }`}>
                      {includeSamples && (
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">With sample apps (Recommended)</p>
                      <p className="text-xs text-muted-foreground">
                        Includes Trust Game, Public Goods, and other examples
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIncludeSamples(false)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    !includeSamples
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-border hover:border-blue-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !includeSamples ? 'border-blue-500' : 'border-muted-foreground'
                    }`}>
                      {!includeSamples && (
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Empty project</p>
                      <p className="text-xs text-muted-foreground">
                        Blank project structure for experienced users
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Progress Display */}
          {isCreatingProject && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg
                  className="animate-spin h-5 w-5 text-blue-400"
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
                <span className="text-sm font-medium text-blue-400">{creationProgress.status}</span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${creationProgress.percent}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {creationProgress.percent}% complete
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setProjectSetupOption(null)}
              disabled={isCreatingProject}
              className="px-6 h-12 rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleCreateProject}
              disabled={!projectName || !projectLocation || !selectedPython || isCreatingProject}
              className="flex-1 h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              {isCreatingProject ? (
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
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </div>
      )
    }

    // Open Existing Project Sub-interface
    if (projectSetupOption === 'open') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Open Existing Project</h2>
            <p className="text-muted-foreground">
              Browse to your existing oTree project folder
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={existingProjectPath}
                  onChange={(e) => {
                    setExistingProjectPath(e.target.value)
                    setValidationMessage('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleValidateManualPath()
                    }
                  }}
                  placeholder="Select your oTree project folder..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleValidateManualPath}
                  disabled={!existingProjectPath || isValidatingProject}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Validate path"
                >
                  {isValidatingProject ? (
                    <svg
                      className="animate-spin h-5 w-5"
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
                  ) : (
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
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={handleBrowseExistingProject}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
                >
                  Browse
                </button>
              </div>

              {/* Validation Status */}
              {validationMessage && (
                <p className={`text-sm mt-2 ${
                  validationMessage.startsWith('✓')
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {validationMessage}
                </p>
              )}
            </div>

            <div className="bg-secondary/50 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> We'll verify that the folder contains a valid oTree project (requires settings.py)
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setProjectSetupOption(null)}
              className="px-6 h-12 rounded-md border border-border hover:bg-secondary transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleOpenExistingProject}
              disabled={!existingProjectPath || !validationMessage.startsWith('✓')}
              className="flex-1 h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              Open Project
            </button>
          </div>
        </div>
      )
    }

    // Import from oTreeHub Sub-interface
    if (projectSetupOption === 'import') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Import from oTreeHub</h2>
            <p className="text-muted-foreground">
              Select the .otreezip file you downloaded from oTreeHub
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            {/* .otreezip file selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">.otreezip File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otreezipPath}
                  readOnly
                  placeholder="Select your .otreezip file..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleBrowseOtreezip}
                  disabled={isImporting}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Browse
                </button>
              </div>
              {otreezipPath && (
                <p className="text-xs text-muted-foreground truncate" title={otreezipPath}>
                  Selected: {otreezipPath}
                </p>
              )}
            </div>

            {/* Extraction location */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Extract To</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={extractLocation}
                  onChange={(e) => setExtractLocation(e.target.value)}
                  placeholder="Select destination folder..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleBrowseExtractLocation}
                  disabled={isImporting}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Browse
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                The project will be extracted to this location
              </p>
            </div>

            {/* Info box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-400">
                <strong>About .otreezip files:</strong> These are special project archives from oTreeHub containing complete oTree experiments ready to use.
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          {isImporting && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <svg
                  className="animate-spin h-5 w-5 text-green-400"
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
                <span className="text-sm font-medium text-green-400">{importProgress.status}</span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.percent}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {importProgress.percent}% complete
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setProjectSetupOption(null)}
              disabled={isImporting}
              className="px-6 h-12 rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleImportOtreezip}
              disabled={!otreezipPath || !extractLocation || isImporting}
              className="flex-1 h-12 px-6 rounded-md bg-green-600 hover:bg-green-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600 flex items-center justify-center gap-2"
            >
              {isImporting ? (
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
                  Importing...
                </>
              ) : (
                'Import Project'
              )}
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold">You're All Set!</h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Your oTree Launcher is ready to use. Here's what to do next:
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">Quick Start Guide:</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-medium">
                {createdProjectPath ? 'Your Project is Ready' : 'Select Your Project Folder'}
              </p>
              <p className="text-sm text-muted-foreground">
                {createdProjectPath
                  ? `Project located at: ${createdProjectPath}`
                  : 'Click "Change Folder" to select your oTree project directory'
                }
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-medium">Install Requirements</p>
              <p className="text-sm text-muted-foreground">
                Click "Install Requirements" to set up your virtual environment and install oTree
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-medium">Start Your Server</p>
              <p className="text-sm text-muted-foreground">
                Click "Start Server" to launch your oTree experiment
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedPython && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm">
            <strong className="text-blue-400">Python {selectedPython.version}</strong> has been selected as your default Python version.
          </p>
        </div>
      )}

      <button
        onClick={handleComplete}
        className="w-full h-12 px-6 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all"
      >
        Start Using oTree Launcher
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['welcome', 'python', 'project', 'complete'] as WizardStep[]).map((step, index) => (
              <React.Fragment key={step}>
                {index > 0 && (
                  <div className={`h-0.5 w-8 ${
                    (['welcome', 'python', 'project', 'complete'] as WizardStep[]).indexOf(currentStep) > index - 1
                      ? 'bg-blue-500'
                      : 'bg-border'
                  }`}></div>
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === step
                    ? 'bg-blue-500 text-white'
                    : (['welcome', 'python', 'project', 'complete'] as WizardStep[]).indexOf(currentStep) > index
                      ? 'bg-green-500 text-white'
                      : 'bg-border text-muted-foreground'
                }`}>
                  {(['welcome', 'python', 'project', 'complete'] as WizardStep[]).indexOf(currentStep) > index ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 'welcome' && renderWelcomeStep()}
          {currentStep === 'python' && renderPythonStep()}
          {currentStep === 'project' && renderProjectStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </div>
      </div>
    </div>
  )
}

export default WelcomeWizard

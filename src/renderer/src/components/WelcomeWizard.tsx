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

const WelcomeWizard: React.FC<WelcomeWizardProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [pythonVersions, setPythonVersions] = useState<Array<{ version: string; path: string }>>([])
  const [selectedPython, setSelectedPython] = useState<{ version: string; path: string } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [sampleProjectPath, setSampleProjectPath] = useState<string>('')
  const [isDownloadingSample, setIsDownloadingSample] = useState(false)

  // Auto-scan for Python when reaching the Python step
  useEffect(() => {
    if (currentStep === 'python' && pythonVersions.length === 0 && !isScanning) {
      scanPython()
    }
  }, [currentStep])

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

  const handleDownloadSampleProject = async () => {
    setIsDownloadingSample(true)
    try {
      const result = await window.api.extractSampleProject()

      if (result.success && result.path) {
        setSampleProjectPath(result.path)
        setIsDownloadingSample(false)
        setCurrentStep('complete')
      } else {
        // Show error
        alert(result.error || 'Failed to extract sample project')
        setIsDownloadingSample(false)
      }
    } catch (error) {
      console.error('Failed to extract sample project:', error)
      alert('An error occurred while extracting the sample project')
      setIsDownloadingSample(false)
    }
  }

  const handleComplete = () => {
    const config: {
      projectPath?: string
      pythonVersion?: string
      pythonPath?: string
    } = {}

    if (sampleProjectPath) {
      config.projectPath = sampleProjectPath
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
              <p className="font-medium">Download Sample Project (Optional)</p>
              <p className="text-sm text-muted-foreground">Try out a simple Trust Game experiment</p>
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

  const renderProjectStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Sample Project</h2>
        <p className="text-muted-foreground">
          Would you like to extract a sample Risk Preferences experiment to get started?
        </p>
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
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
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Risk Preferences Sample</h3>
            <p className="text-sm text-muted-foreground mt-1">
              A classic behavioral economics experiment for measuring risk attitudes. Perfect for learning oTree basics!
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/20 text-blue-400 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Beginner-friendly
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Included in app
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Single-player
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Note:</strong> The sample project will be extracted to your Documents folder.
          You can also skip this step and select your own oTree project folder in the main interface.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('python')}
          className="px-6 h-12 rounded-md border border-border hover:bg-secondary transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => {
            setCurrentStep('complete')
          }}
          className="flex-1 h-12 px-6 rounded-md border border-border hover:bg-secondary transition-colors"
        >
          Skip Sample
        </button>
        <button
          onClick={handleDownloadSampleProject}
          disabled={isDownloadingSample}
          className="flex-1 h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDownloadingSample ? (
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
              Preparing...
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
              Get Sample Project
            </>
          )}
        </button>
      </div>
    </div>
  )

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
              <p className="font-medium">Select Your Project Folder</p>
              <p className="text-sm text-muted-foreground">
                Click "Change Folder" to select your oTree project directory
                {sampleProjectPath && ` (or use the sample at ${sampleProjectPath})`}
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
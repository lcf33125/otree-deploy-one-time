// IPC Channel Constants
export const IPC_CHANNELS = {
  // Dialog
  OPEN_FOLDER: 'dialog:openFolder',

  // oTree Operations
  OTREE_START: 'otree:start',
  OTREE_START_PYTHON: 'otree:start-python',
  OTREE_STOP: 'otree:stop',
  OTREE_INSTALL_REQUIREMENTS: 'otree:install-requirements',
  OTREE_CHECK_REQUIREMENTS: 'otree:check-requirements',
  OTREE_SCAN_PYTHON_VERSIONS: 'otree:scan-python-versions',
  OTREE_GET_DOCUMENTS_PATH: 'otree:get-documents-path',
  OTREE_GET_VENV_INFO: 'otree:get-venv-info',
  OTREE_CLEAN_VENV: 'otree:clean-venv',

  // oTree Status/Logs
  OTREE_LOGS: 'otree:logs',
  OTREE_STATUS: 'otree:status',
  OTREE_INSTALL_STATUS: 'otree:install-status',
  OTREE_CHECK_STATUS: 'otree:check-status',
  OTREE_SERVER_URL: 'otree:server-url',

  // Python Management
  PYTHON_GET_VERSIONS: 'python:get-versions',
  PYTHON_GET_AVAILABLE_VERSIONS: 'python:get-available-versions',
  PYTHON_SCAN_SYSTEM: 'python:scan-system',
  PYTHON_DOWNLOAD: 'python:download',
  PYTHON_DOWNLOAD_STATUS: 'python:download-status',
  PYTHON_DOWNLOAD_PROGRESS: 'python:download-progress',
  PYTHON_SET_PROJECT_VERSION: 'python:set-project-version',
  PYTHON_GET_PROJECT_VERSION: 'python:get-project-version',
  PYTHON_GET_PATH: 'python:get-path',
  PYTHON_DELETE: 'python:delete',
  PYTHON_IS_INSTALLED: 'python:is-installed',
  PYTHON_REPAIR: 'python:repair',

  // Misc
  PING: 'ping',
  OPEN_URL: 'open-url',

  // Sample Project (deprecated - will be removed)
  EXTRACT_SAMPLE_PROJECT: 'sample:extract',

  // Project Creation
  OTREE_CREATE_PROJECT: 'otree:create-project',
  OTREE_VALIDATE_PROJECT: 'otree:validate-project',
  OTREE_PROJECT_CREATION_PROGRESS: 'otree:creation-progress',

  // Project Import
  OTREE_SELECT_OTREEZIP: 'otree:select-otreezip',
  OTREE_IMPORT_OTREEZIP: 'otree:import-otreezip',
  OTREE_IMPORT_PROGRESS: 'otree:import-progress'
} as const

// Docker Compose file name
export const DOCKER_COMPOSE_FILENAME = 'docker-compose-launcher.yml'

// Default ports
export const DEFAULT_OTREE_PORT = 8000

// Virtual environment directory name
export const VENV_BASE_DIR = 'venvs'

// Log directory name
export const LOG_DIR = 'launcher-logs'

// Error codes
export const ERROR_CODES = {
  PORT_IN_USE: 'EADDRINUSE',
  ERRNO_10048: 'Errno 10048' // Windows specific
} as const

// Status messages
export const STATUS_MESSAGES = {
  STOPPING: 'Stopping server...',
  STOPPED: 'Server stopped.',
  INITIALIZING_DOCKER: 'Initializing Docker environment...',
  CONFIG_GENERATED: 'Config generated. Starting containers...',
  STARTING_VENV: 'Starting oTree server from venv...',
  CREATING_VENV: 'Creating virtual environment',
  VENV_CREATED: 'Virtual environment created successfully.',
  USING_EXISTING_VENV: 'Using existing virtual environment at:',
  INSTALLING_REQUIREMENTS: 'Installing requirements from requirements.txt...',
  INSTALLING_OTREE: 'No requirements.txt found. Installing otree and common dependencies...',
  REQUIREMENTS_INSTALLED: 'Requirements installed successfully in venv.',
  OTREE_INSTALLED: 'otree installed successfully in venv.',
  INSTALLATION_FAILED: 'Installation failed with code',
  OTREE_NOT_FOUND: 'ERROR: otree not found in virtual environment. Please install dependencies first.',
  USING_PORT: 'Using port',
  PROCESS_EXITED: 'Process exited with code',
  SERVER_EXITED: 'Server process exited with code',
  PORT_BUSY: 'is already in use. This process stopped, but the server is running (likely from a previous instance).'
} as const

// System messages
export const SYSTEM_MESSAGES = {
  CONTROL_C_WARNING: '[SYSTEM] ⚠️  In this GUI app, use the "Stop Server" button instead of Control+C.\n'
} as const

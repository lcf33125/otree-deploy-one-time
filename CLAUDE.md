# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oTree Launcher is an Electron desktop application (React + TypeScript) that helps users run oTree experiments locally. It provides Python version management, virtual environment handling, and can launch oTree projects using either a local Python environment or Docker Compose.

## Commands

### Development
```bash
npm run dev              # Hot-reload development mode
npm run start            # Preview built app without packaging
```

### Type Checking
```bash
npm run typecheck        # Run both node + web type checks
npm run typecheck:node   # Main/preload processes (tsconfig.node.json)
npm run typecheck:web    # Renderer process (tsconfig.web.json)
```

### Code Quality
```bash
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

### Building
```bash
npm run build            # Type check + build (runs typecheck automatically)
npm run build:win        # Full production build for Windows
npm run build:mac        # Full production build for macOS
npm run build:linux      # Full production build for Linux
npm run build:unpack     # Build without packaging (useful for testing)
```

## Architecture

### Electron Three-Process Model

1. **Main Process** ([src/main/index.ts](src/main/index.ts))
   - App lifecycle and window management
   - Sets up IPC handlers via `setupOtreeHandlers()` from [otree-controller.ts](src/main/otree-controller.ts)
   - Handles cleanup on quit via `killOtreeProcess()`

2. **Preload Script** ([src/preload/index.ts](src/preload/index.ts))
   - Bridges main and renderer via `contextBridge`
   - Exposes `window.api` with typed IPC methods
   - **Critical**: When adding IPC channels, update both preload and renderer TypeScript interfaces

3. **Renderer Process** ([src/renderer/src/](src/renderer/src/))
   - React UI consuming `window.api`
   - Uses `@renderer` alias for imports (defined in [electron.vite.config.ts](electron.vite.config.ts))

### Core Modules

#### [src/main/otree-controller.ts](src/main/otree-controller.ts)
Central orchestration for oTree operations. Registers 20 IPC handlers including:
- `dialog:openFolder` - Directory selection
- `otree:start` - Docker Compose mode (generates `docker-compose-launcher.yml`)
- `otree:start-python` - Python venv mode
- `otree:install-requirements` - Creates venv and installs dependencies
- `otree:stop` - Stops running processes
- `otree:create-project` - Creates new oTree project using `otree startproject`
- `otree:validate-project` - Validates existing oTree project structure
- `python:*` - Python version management handlers

**Key Implementation Details:**
- Streams stdout/stderr to renderer via `otree:logs` events
- Uses `spawn()` without `shell: true` for security (avoid command injection)
- On Windows, uses `taskkill /T /F` to kill process trees (regular `.kill()` only kills shell)
- Detects server readiness by parsing logs for `http://localhost:{port}`
- Injects system messages when detecting Control+C instructions

**Project Creation:**
- Executes `otree startproject <name>` directly (not via `python -m otree`)
- Automatically installs oTree if not found in the Python environment
- Locates otree executable in Python's Scripts directory (Windows) or bin directory (Unix)
- Sends progress updates via `otree:creation-progress` events
- Validates project creation by checking for `settings.py`
- Handles interactive prompts by automatically sending 'y' or 'n' via stdin based on user preference
- Uses 1-second delay before sending stdin to ensure prompt is ready

#### [src/main/python-manager.ts](src/main/python-manager.ts)
Manages Python installations (download, install, track):
- Downloads embeddable Python from python.org (3.7-3.13)
- Sets up pip and virtualenv for embeddable distributions
- Scans system for existing Python installations
- Maintains registry at `{userData}/python-versions.json`
- Stores downloaded Pythons in `{userData}/pythons/{version}/`

#### [src/main/constants.ts](src/main/constants.ts)
Centralized IPC channel names, status messages, error codes. **Always import from here** instead of hardcoding strings.

#### [src/main/types.ts](src/main/types.ts)
TypeScript interfaces for Docker configs, Python versions, venv paths.

#### [src/main/utils.ts](src/main/utils.ts)
Validation utilities for project paths and file paths (security).

### Virtual Environment Strategy

**Critical Design Decision**: Virtual environments are stored in `{userData}/venvs/{projectHash}` instead of the user's project directory.

**Why:**
- Keeps user projects clean (no `venv/` pollution)
- Centralizes venv management
- Project hash (MD5 of absolute path) ensures unique venvs per project

**Implications:**
- Each project path gets its own isolated venv
- Moving a project creates a new venv (different hash)
- Venv location retrieved via `getVenvPaths()` in [otree-controller.ts](src/main/otree-controller.ts)

### IPC Communication Pattern

```typescript
// Main: Handle requests
ipcMain.handle('channel:name', async () => {...})  // Returns value
ipcMain.on('channel:name', async (event, arg) => {...})  // No return, use events for responses

// Preload: Expose to renderer
window.api = {
  methodName: () => ipcRenderer.invoke('channel:name'),
  onEvent: (callback) => ipcRenderer.on('channel:event', (_event, value) => callback(value))
}

// Renderer: TypeScript interfaces required
interface IElectronAPI { methodName: () => Promise<T> }
declare global { interface Window { api: IElectronAPI } }
```

### Process Lifecycle Management

- **Single global process**: `otreeProcess: ChildProcess | null` in [otree-controller.ts](src/main/otree-controller.ts)
- **No pooling**: Only one oTree instance runs at a time
- **Docker mode** (`isDockerMode = true`): Runs `docker compose down` on stop
- **Python mode** (`isDockerMode = false`): Kills process by PID and port
- **Cleanup guard**: `isCleaningUp` flag prevents concurrent cleanup

### Docker Config Generation

`generateComposeConfig()` creates Docker Compose YAML programmatically with:
- PostgreSQL 12 (generated secure password via `generateSecurePassword()`)
- Redis 6
- Python 3.9-slim web container
- Auto-installs requirements.txt and runs `otree devserver`

**Never hardcode** the compose file - always generate it so changes propagate automatically.

### Path Handling (macOS)

Main process calls `fixPath()` at module top-level to ensure Docker CLI is found on macOS (GUI apps have limited PATH). **Always import this pattern** when adding shell commands.

### Log Streaming

```typescript
// Main: Send logs
mainWindow.webContents.send('otree:logs', logString)

// Renderer: Auto-scroll pattern
const bottomRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [logs])
```

### Port Management

- Tries `DEFAULT_OTREE_PORT` (8000) first via `getPort()`
- If busy, finds random free port
- Binds test to `127.0.0.1` specifically to avoid IPv4/IPv6 conflicts
- Waits 200ms after closing test server before declaring port free

## Project-Specific Conventions

### Security Practices

1. **Path Validation**: All user-provided paths go through `validateProjectPath()` and `validateFilePath()` to prevent directory traversal
2. **No shell injection**: Use `spawn(cmd, args, {...})` instead of `spawn(cmd, { shell: true })`
3. **Secure credentials**: Docker passwords generated via `crypto.randomBytes()`, never hardcoded
4. **NEVER use `shell: true`** in spawn calls (already removed from codebase per security review)

### TypeScript in Preload

Preload uses plain JavaScript at runtime but must match renderer's TypeScript interface. When adding IPC methods, update:
1. [src/preload/index.ts](src/preload/index.ts) - Add method to `api` object
2. Renderer TypeScript declarations - Update `IElectronAPI` interface

### Styling Approach

**Uses Tailwind CSS 4.x** with PostCSS configuration. CSS files in `src/renderer/src/assets/`.

### External Dependencies

1. **Docker Desktop** (runtime dependency for Docker mode): App spawns `docker compose` commands
2. **Python** (system or managed): Required for Python mode
3. **Node modules**: Standard Electron + React stack

## Common Tasks

### Adding New IPC Channels

1. Add constant to [src/main/constants.ts](src/main/constants.ts) `IPC_CHANNELS`
2. Define handler in [src/main/otree-controller.ts](src/main/otree-controller.ts): `ipcMain.handle()` or `ipcMain.on()`
3. Expose in [src/preload/index.ts](src/preload/index.ts): Add to `api` object
4. Add to renderer interface (if using TypeScript)

### Creating New oTree Projects

The app supports creating new oTree projects via the Welcome Wizard or programmatically:

**Via Welcome Wizard ([src/renderer/src/components/WelcomeWizard.tsx](src/renderer/src/components/WelcomeWizard.tsx)):**
1. User selects "Create New Project" option
2. Enters project name, location, and template preference (with/without samples)
3. App calls `window.api.createOtreeProject()` with parameters
4. Backend installs oTree if needed, then runs `otree startproject`
5. Progress updates sent via `otree:creation-progress` events
6. Project path auto-populated on completion

**Project Validation:**
- Use `window.api.validateOtreeProject(path)` to check existing projects
- Validates presence of `settings.py` and `requirements.txt`
- Returns validation result with `isValid` flag and message

**Flow:**
```typescript
// Create new project
const result = await window.api.createOtreeProject({
  projectName: 'my_experiment',
  targetPath: '/path/to/parent/directory',
  pythonPath: '/path/to/python',
  includeSamples: true  // false for empty project
})

// Validate existing project
const validation = await window.api.validateOtreeProject('/path/to/project')
if (validation.isValid) {
  // Proceed with project
}
```

### Updating Docker Config

Edit `generateComposeConfig()` in [otree-controller.ts](src/main/otree-controller.ts). File regenerates on each start, so changes take effect immediately.

### Debugging

- **Main process logs**: Run `npm run dev` and check terminal (stdout)
- **Renderer logs**: DevTools console (F12)
- **IPC communication**: Add console.log in preload bridge to trace calls

### Working with Virtual Environments

- Location: `app.getPath('userData')/venvs/{md5Hash}`
- Get info: `window.api.getVenvInfo(projectPath)`
- Clean: `window.api.cleanVenv(projectPath)`
- Create: Handled automatically by `otree:install-requirements`

### Python Version Management

- Managed Pythons stored in: `{userData}/pythons/{version}/`
- Registry file: `{userData}/python-versions.json`
- Download flow: renderer → `python:download` → PythonManager → progress events → `python:download-status`
- Embeddable Pythons require `virtualenv` (auto-installed during setup)
- System Pythons use standard `venv` module

## Build Configuration

- **Product Name**: oTree Launcher
- **App ID**: `com.electron.otree-launcher`
- **Build config**: [electron-builder.yml](electron-builder.yml)
- **Vite config**: [electron.vite.config.ts](electron.vite.config.ts)
- **Externalized deps**: `yaml` (declared in rollupOptions)

## Key Files Reference

- [src/main/index.ts](src/main/index.ts) - App entry point
- [src/main/otree-controller.ts](src/main/otree-controller.ts) - Core business logic
- [src/main/python-manager.ts](src/main/python-manager.ts) - Python version management
- [src/main/constants.ts](src/main/constants.ts) - IPC channels and constants
- [src/main/types.ts](src/main/types.ts) - TypeScript types
- [src/main/utils.ts](src/main/utils.ts) - Validation utilities
- [src/preload/index.ts](src/preload/index.ts) - IPC bridge
- [src/renderer/src/App.tsx](src/renderer/src/App.tsx) - Main UI component
- [src/renderer/src/components/WelcomeWizard.tsx](src/renderer/src/components/WelcomeWizard.tsx) - Onboarding wizard

## Welcome Wizard

The Welcome Wizard guides new users through initial setup with a 4-step flow:

1. **Welcome**: Overview of the setup process
2. **Python Setup**: Scan/select Python installation
3. **Project Setup**: Three options:
   - **Create New Project**: Use `otree startproject` with optional samples
   - **Open Existing Project**: Browse and validate existing oTree project
   - **Skip**: Continue to main interface without project setup
4. **Complete**: Summary and next steps

**Key Features:**
- First-launch detection via localStorage flag `otree-launcher-welcome-completed`
- Can be re-triggered via Settings → "Reset Welcome Wizard"
- Auto-populates project path and Python version in main interface
- Real-time validation of existing projects (checks for `settings.py`)
- Progress tracking for project creation with status updates

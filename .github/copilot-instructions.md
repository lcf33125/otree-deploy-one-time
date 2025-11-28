# oTree Deploy One-Click - Copilot Instructions

## Project Overview

Electron desktop app that launches oTree projects using Docker Compose. Users select a local oTree folder, and the app generates a docker-compose config, starts containers (PostgreSQL, Redis, Python web), and streams logs to a console UI.

## Architecture

### Three-Process Model (Electron Standard)

- **Main Process** (`src/main/index.ts`): App lifecycle, window management, imports `otree-controller.ts`
- **Preload** (`src/preload/index.ts`): Bridges main/renderer via `contextBridge`, exposes `window.api`
- **Renderer** (`src/renderer/src/App.tsx`): React UI consuming `window.api`

### Key Module: `otree-controller.ts`

Central orchestration for Docker operations:

- `setupOtreeHandlers(mainWindow)`: Registers 3 IPC handlers
  - `dialog:openFolder` (invoke): Returns selected directory path
  - `otree:start` (send): Generates `docker-compose-launcher.yml` in user's project folder, spawns `docker compose up --build`
  - `otree:stop` (send): Runs `docker compose down`, kills process
- Streams stdout/stderr to renderer via `otree:logs` events
- Detects server readiness by parsing logs for `http://0.0.0.0:8000`

### IPC Communication Pattern

```typescript
// Main: Handle requests
ipcMain.handle('dialog:openFolder', async () => {...}) // Returns value
ipcMain.on('otree:start', async (event, projectPath) => {...}) // No return

// Preload: Expose to renderer
window.api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  startOtree: (path) => ipcRenderer.send('otree:start', path),
  onLogs: (callback) => ipcRenderer.on('otree:logs', (_event, value) => callback(value))
}

// Renderer: TypeScript interfaces required
interface IElectronAPI { selectFolder: () => Promise<string>; ... }
declare global { interface Window { api: IElectronAPI } }
```

## Development Workflows

### Running the App

```bash
npm run dev          # Hot-reload development mode
npm run start        # Preview built app without packaging
npm run build:win    # Full production build for Windows
```

### Type Checking (Critical Before Build)

```bash
npm run typecheck        # Runs both node + web checks
npm run typecheck:node   # Main/preload processes (tsconfig.node.json)
npm run typecheck:web    # Renderer process (tsconfig.web.json)
```

**Note**: `npm run build` automatically runs typecheck first.

### Dependencies Not in package.json

The following imports require manual type installation if missing:

- `fs-extra` → `@types/node` already covers `fs`, but for `fs-extra` specifics, ensure `@types/fs-extra`
- `yaml` → Check for `@types/yaml` if IDE complains
- `fix-path` → macOS PATH fixer, usually no types needed

## Project-Specific Conventions

### 1. Docker Config Generation

`generateComposeConfig()` in `otree-controller.ts` creates an in-memory YAML object dynamically. **Never hardcode** the compose file—always generate it programmatically so changes propagate automatically.

### 2. Path Handling (macOS Fix)

Main process calls `fixPath()` at module top-level to ensure Docker CLI is found on macOS (where GUI apps have limited PATH). **Always import this** when adding new shell commands.

### 3. Log Streaming Pattern

```typescript
// Main: Send logs
mainWindow.webContents.send('otree:logs', logString)

// Renderer: Auto-scroll with ref
const bottomRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [logs])
```

### 4. TypeScript in Preload

Preload uses **plain JavaScript types** at runtime but must match renderer's TypeScript interface. Update both `src/preload/index.ts` AND the `IElectronAPI` interface in `App.tsx` when adding IPC methods.

### 5. Vite Alias for Renderer

`@renderer` → `src/renderer/src` (defined in `electron.vite.config.ts`). Use this for cleaner imports:

```typescript
import Component from '@renderer/components/MyComponent'
```

### 6. CSS Approach

**No Tailwind**. Uses plain CSS with CSS variables in `src/renderer/src/assets/base.css`. Inline Tailwind-like class names in `App.tsx` (`className="flex gap-4"`) are **fake**—they're defined manually in CSS or rely on basic flexbox/gap support.

## External Dependencies

### Docker Desktop

**Required runtime dependency**. App spawns `docker compose` commands via `child_process.spawn()`. User must have Docker installed and running.

### Process Lifecycle

- Single global `otreeProcess: ChildProcess | null`
- Kill on stop, clean up with `docker compose down`
- **No process pooling**—only one oTree instance at a time

## Common Tasks

### Adding New IPC Channels

1. Define handler in `otree-controller.ts`: `ipcMain.handle('my:action', async () => {...})`
2. Expose in `preload/index.ts`: `myAction: () => ipcRenderer.invoke('my:action')`
3. Add to interface in `App.tsx`: `interface IElectronAPI { myAction: () => Promise<X> }`

### Debugging Main Process Logs

Run `npm run dev` and check the terminal (not DevTools). Main process logs appear in stdout.

### Updating Docker Config

Edit `generateComposeConfig()` return object. File is regenerated on each start, so changes take effect immediately.

### Styling Changes

Modify `src/renderer/src/assets/main.css` or `base.css`. Avoid assuming Tailwind utilities exist unless manually defined.

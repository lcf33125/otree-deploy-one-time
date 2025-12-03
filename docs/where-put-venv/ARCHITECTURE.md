# Virtual Environment Architecture Diagram

## Before (Old System)

```
User's File System
│
├── Documents/
│   └── oTreeProjects/
│       ├── project1/
│       │   ├── venv/              ❌ Pollutes project directory
│       │   ├── settings.py
│       │   └── requirements.txt
│       │
│       └── project2/
│           ├── venv/              ❌ Pollutes project directory
│           ├── settings.py
│           └── requirements.txt
```

**Problems:**
- ❌ Venv mixed with user code
- ❌ Risk of git commits
- ❌ Not portable
- ❌ Cluttered project structure

---

## After (New System)

```
User's File System
│
├── Documents/
│   └── oTreeProjects/
│       ├── project1/               ✅ Clean project directory
│       │   ├── settings.py
│       │   └── requirements.txt
│       │
│       └── project2/               ✅ Clean project directory
│           ├── settings.py
│           └── requirements.txt
│
└── AppData/Roaming/oTree Launcher/
    └── venvs/
        ├── a1b2c3d4/              ← Hash of project1 path
        │   ├── Scripts/
        │   ├── Lib/
        │   └── pyvenv.cfg
        │
        └── e5f6g7h8/              ← Hash of project2 path
            ├── Scripts/
            ├── Lib/
            └── pyvenv.cfg
```

**Benefits:**
- ✅ Projects stay clean
- ✅ Centralized venv management
- ✅ No accidental commits
- ✅ Portable app design

---

## System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                          │
│                  "Install Requirements"                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  handleInstall()                                      │  │
│  │  → window.api.installRequirements(projectPath, ...)  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ IPC
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Preload (Bridge)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ipcRenderer.send('otree:install-requirements', ...) │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Main Process (Node)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. getVenvPaths(projectPath)                        │  │
│  │     └─> Hash project path → a1b2c3d4                │  │
│  │     └─> Build venv path:                            │  │
│  │         userData/venvs/a1b2c3d4                     │  │
│  │                                                       │  │
│  │  2. Check if venv exists                             │  │
│  │     └─> fs.existsSync(venvDir)                      │  │
│  │                                                       │  │
│  │  3. Create venv if needed                            │  │
│  │     └─> spawn('python', ['-m', 'venv', venvPath])  │  │
│  │                                                       │  │
│  │  4. Install requirements                             │  │
│  │     └─> spawn(pip, ['install', '-r', 'req.txt'])   │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ Status Updates
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     UI Updates                              │
│  • "Creating virtual environment..."                       │
│  • "Location: C:\Users\...\venvs\a1b2c3d4"               │
│  • "Installing requirements..."                            │
│  • ✓ "Requirements Installed"                             │
│  • Shows venv info box with path and status               │
└─────────────────────────────────────────────────────────────┘
```

---

## Hash Mapping System

```
Input: Project Path
│
├─> "C:\Users\John\Documents\oTreeProjects\risk_preferences"
│
└─> MD5 Hash → "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
    │
    └─> First 8 chars → "a1b2c3d4"
        │
        └─> Venv Path: "userData/venvs/a1b2c3d4"

Benefits:
• Deterministic: Same project → Same hash
• Unique: Different projects → Different hashes
• Compact: Only 8 characters
• Collision resistant: ~4 billion combinations
```

---

## Data Flow: Get Venv Info

```
┌─────────────┐
│  Frontend   │
│  useEffect  │
└──────┬──────┘
       │
       │ window.api.getVenvInfo(projectPath)
       │
       ▼
┌─────────────┐
│   Preload   │
│  IPC Bridge │
└──────┬──────┘
       │
       │ ipcRenderer.invoke('otree:get-venv-info', path)
       │
       ▼
┌──────────────────────────────────────┐
│           Main Process               │
│  ┌────────────────────────────────┐  │
│  │ 1. getVenvPaths(projectPath)  │  │
│  │ 2. fs.existsSync(venvDir)     │  │
│  │ 3. Return:                     │  │
│  │    {                           │  │
│  │      venvDir: "path",         │  │
│  │      exists: true/false,      │  │
│  │      venvBaseDir: "base"      │  │
│  │    }                           │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
       │
       │ Promise resolves
       │
       ▼
┌─────────────┐
│  Frontend   │
│  setVenvInfo│
└──────┬──────┘
       │
       │ UI updates to show venv location
       │
       ▼
┌─────────────────────────────────┐
│  Virtual Environment Info Box  │
│  ┌───────────────────────────┐  │
│  │ • Full path displayed     │  │
│  │ • Status: Exists/Not      │  │
│  │ • Green/Gray dot          │  │
│  │ • Clean button (if exists)│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## File Structure

```
otree-deploy-one-time/
│
├── src/
│   ├── main/
│   │   └── otree-controller.ts     ← Hash generation, venv management
│   │
│   ├── preload/
│   │   └── index.ts                ← IPC bridge (getVenvInfo, cleanVenv)
│   │
│   └── renderer/
│       └── src/
│           └── App.tsx              ← UI state, venv display, clean handler
│
├── VENV_MANAGEMENT.md               ← User guide
├── IMPLEMENTATION_SUMMARY.md        ← Technical summary
└── ARCHITECTURE.md                  ← This file
```

---

## Cross-Platform Compatibility

```
Platform      | userData Path                                  | Venv Path
──────────────┼────────────────────────────────────────────────┼─────────────────
Windows       | C:\Users\{user}\AppData\Roaming\oTree Launcher| .../venvs/{hash}
macOS         | ~/Library/Application Support/oTree Launcher  | .../venvs/{hash}
Linux         | ~/.config/oTree Launcher                      | .../venvs/{hash}

All platforms use the same logic:
  app.getPath('userData') + '/venvs/' + hash(projectPath)
```

---

## Error Handling

```
┌─────────────────┐
│ User Action     │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ Try... │
    └───┬────┘
        │
        ├─> ✅ Success
        │   └─> Show success status
        │   └─> Update UI
        │   └─> Enable server controls
        │
        └─> ❌ Error
            ├─> venv creation failed
            │   └─> Show error in logs
            │   └─> Keep "Install" enabled
            │
            ├─> pip install failed
            │   └─> Show error details
            │   └─> Keep venv for retry
            │
            └─> Permission denied
                └─> Show helpful message
                └─> Suggest solutions
```

---

## Cleanup Flow

```
User clicks "Clean"
    │
    ├─> Confirmation Dialog
    │   "Are you sure? You'll need to reinstall."
    │   │
    │   ├─> Cancel → No action
    │   │
    │   └─> OK → Continue
    │
    └─> window.api.cleanVenv(projectPath)
        │
        └─> Main Process
            │
            ├─> getVenvPaths(projectPath)
            │
            ├─> fs.remove(venvDir)
            │   │
            │   ├─> ✅ Success
            │   │   └─> Return {success: true, message: "..."}
            │   │
            │   └─> ❌ Error
            │       └─> Return {success: false, message: "..."}
            │
            └─> Frontend receives result
                │
                ├─> Update installStatus → 'idle'
                ├─> Add log message
                ├─> Refresh venvInfo
                └─> UI shows "Not created yet"
```

---

## Security Model

```
┌─────────────────────────────────────┐
│         Security Layers             │
├─────────────────────────────────────┤
│                                     │
│  ✓ No elevated permissions needed  │
│  ✓ User's own data directory       │
│  ✓ Standard Electron security      │
│  ✓ IPC validation                  │
│  ✓ Path sanitization               │
│  ✓ No shell injection              │
│  ✓ Confirmation for destructive    │
│    operations (Clean)               │
│                                     │
└─────────────────────────────────────┘
```

---

## Performance Characteristics

| Operation              | Time Complexity | Space Complexity |
|------------------------|-----------------|------------------|
| Hash Generation        | O(1)            | O(1)             |
| Venv Path Lookup       | O(1)            | O(1)             |
| Venv Creation          | O(n)            | O(n)             |
| Requirements Install   | O(n)            | O(n)             |
| Get Venv Info          | O(1)            | O(1)             |
| Clean Venv             | O(n)            | O(1)             |

*n = number of packages/files*

---

## State Management

```
Frontend State:
  ├── projectPath: string
  ├── installStatus: 'idle' | 'installing' | 'success' | 'error'
  ├── venvInfo: { venvDir: string, exists: boolean } | null
  └── logs: string[]

Backend State:
  ├── otreeProcess: ChildProcess | null
  ├── currentProjectPath: string | null
  ├── currentLogPath: string | null
  └── currentPort: number

Sync Mechanism:
  ├── IPC events (otree:logs, otree:status, etc.)
  ├── Promise-based API calls
  └── React useEffect hooks
```

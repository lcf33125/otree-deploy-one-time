# Python Version Management - Phase 1 Implementation Summary

## Date: November 30, 2025

## Overview

Successfully implemented Phase 1 of Python Version Management for the oTree Launcher, enabling users to download, manage, and switch between Python versions 3.7-3.13 without leaving the application.

---

## What Was Implemented

### 1. **Core Python Manager Module** (`src/main/python-manager.ts`)

- **Download System**: Downloads official Python embeddable packages from python.org
- **Installation**: Automatic extraction and configuration
- **pip Setup**: Downloads and installs pip using get-pip.py
- **virtualenv Setup**: Installs virtualenv for venv creation (embeddable Python requirement)
- **System Scan**: Detects existing Python installations on Windows
- **Registry Management**: JSON-based registry tracking managed and system Pythons
- **Project Preferences**: Per-project Python version selection

### 2. **IPC Handlers** (`src/main/otree-controller.ts`)

Added 9 new IPC handlers:
- `python:get-versions` - Get all Python versions
- `python:get-available-versions` - Get downloadable versions
- `python:scan-system` - Scan for system Pythons
- `python:download` - Download a Python version
- `python:set-project-version` - Set project's Python preference
- `python:get-project-version` - Get project's Python preference
- `python:get-path` - Get path for a version
- `python:delete` - Delete a managed Python
- `python:is-installed` - Check if version is installed

### 3. **Preload Bridge** (`src/preload/index.ts`)

Exposed all Python management functions to renderer:
- `getPythonVersions()`
- `downloadPython(version)`
- `scanSystemPythons()`
- `setProjectPythonVersion(hash, version)`
- `deletePython(version)`
- Plus event listeners for download progress

### 4. **UI Components** (`src/renderer/src/components/PythonVersionManager.tsx`)

**Features**:
- Quick Start section for new users
- Prominent "Download Python 3.11.9 (Recommended)" button
- Installed versions list with source badges (Managed/System)
- oTree compatibility indicators
- Download grid with progress tracking
- Delete functionality for managed Pythons
- System scan button

**UX Improvements**:
- Auto-scan on first load
- Auto-show manager if no Python found
- Recommended version highlighting (⭐)
- Visual indicators (✓ oTree, ⚠️ Limited)

### 5. **Main App Integration** (`src/renderer/src/App.tsx`)

- Added "Manage Versions" button in Environment Setup
- Current Python version display
- Auto-scan on startup
- Project-specific version tracking
- Collapsible Python Manager panel

### 6. **Styling** (`src/renderer/src/assets/main.css`)

- Complete Python Manager styling
- Recommended version special styling
- Progress bars and badges
- Responsive grid layout
- Hover effects and transitions

### 7. **Virtual Environment Fix**

**Problem**: Embeddable Python doesn't include `venv` module

**Solution**:
1. Install `virtualenv` during Python setup
2. Detect managed Python in `otree-controller.ts`
3. Use `virtualenv` instead of `python -m venv` for managed Pythons
4. Log output for debugging

---

## File Changes

### New Files
- `src/main/python-manager.ts` (475 lines)
- `src/renderer/src/components/PythonVersionManager.tsx` (282 lines)
- `docs/PYTHON_VERSION_MANAGEMENT.md` (documentation)
- `docs/IMPLEMENTATION_PHASE1_SUMMARY.md` (this file)

### Modified Files
- `src/main/otree-controller.ts` - Added IPC handlers, virtualenv support
- `src/preload/index.ts` - Exposed Python management API
- `src/renderer/src/App.tsx` - Integrated Python Manager UI
- `src/renderer/src/assets/main.css` - Added styling
- `README.md` - Updated with features list
- `package.json` - Added `unzipper` dependency

---

## Available Python Versions

| Version | Status | oTree Compatible | Notes |
|---------|--------|-----------------|-------|
| 3.7.9   | ✅ Available | ✓ Yes | Legacy support |
| 3.8.10  | ✅ Available | ✓ Yes | Stable |
| 3.9.13  | ✅ Available | ✓ Yes | Stable |
| 3.10.11 | ✅ Available | ✓ Yes | Recommended for older oTree |
| 3.11.9  | ✅ Available | ✓ Yes | **⭐ Recommended** |
| 3.12.7  | ✅ Available | ⚠️ Limited | Newer Python |
| 3.13.0  | ✅ Available | ⚠️ Limited | Latest Python |

---

## Storage Structure

```
%APPDATA%\otree-deploy-one-click\
├── pythons\                    # Managed Python installations
│   ├── 3.11.9\
│   │   ├── python.exe
│   │   ├── Scripts\
│   │   │   ├── pip.exe
│   │   │   └── virtualenv.exe
│   │   └── ...
│   ├── 3.12.7\
│   └── 3.13.0\
├── venvs\                      # Virtual environments (existing)
│   └── {projectHash}\
└── python-versions.json        # Python registry
```

---

## User Flow

### First-Time User
1. Opens app → Auto-scans for Python
2. If none found → Python Manager auto-shows
3. Sees "Quick Start" with recommended Python
4. Clicks "Download Python 3.11.9 (Recommended)"
5. Download completes → Auto-selected
6. Clicks "Install Requirements" → venv created with virtualenv
7. Success!

### Existing User
1. Opens app → Scans Python in background
2. Clicks "Manage Versions" in Environment Setup
3. Sees current Python version
4. Can switch versions or download new ones
5. Each project remembers its Python version

---

## Technical Decisions

### Why Embeddable Python?
- ✅ Official python.org distribution
- ✅ No admin rights needed
- ✅ Small download size (~30MB)
- ✅ Self-contained
- ❌ Requires virtualenv (not venv)

### Why Not Full Installer?
- ❌ Requires admin rights on many systems
- ❌ Larger download
- ❌ May conflict with existing installations
- ❌ Silent install parameters complex

### Why virtualenv Over venv?
- Embeddable Python lacks `venv` module
- `virtualenv` is pure Python, works everywhere
- More flexible and feature-rich
- Industry standard for Python packaging

---

## Known Issues & Limitations

### Current Limitations
1. **Windows Only**: Embeddable Python is Windows-specific
   - Future: Use python-build-standalone for macOS/Linux
2. **Download Size**: ~30MB per version
   - Acceptable for modern internet
3. **No SHA Verification**: Downloads not verified yet
   - Future: Add SHA256 checksum verification

### Fixed Issues
- ✅ Blank screen when opening manager (crypto import fixed)
- ✅ venv creation failure (virtualenv solution)
- ✅ No entry point for new users (Quick Start added)
- ✅ Hidden Python manager (prominent button added)

---

## Testing Checklist

- [x] Download Python 3.11.9
- [x] Install virtualenv automatically
- [x] Create venv using virtualenv
- [x] Install oTree dependencies
- [x] Run oTree server
- [x] Scan system for Python
- [x] Select different Python versions
- [x] Delete managed Python
- [x] Per-project version preferences
- [x] Progress tracking during download
- [x] Error handling and logging

---

## Next Steps (Future Phases)

### Phase 2: Cross-Platform Support
- [ ] macOS support using python-build-standalone
- [ ] Linux support
- [ ] Universal binary detection

### Phase 3: Enhanced Security
- [ ] SHA256 checksum verification
- [ ] GPG signature verification
- [ ] Download retry logic
- [ ] Integrity validation

### Phase 4: Advanced Features
- [ ] Auto-detect oTree version requirements
- [ ] Suggest compatible Python version
- [ ] Disk usage display and cleanup
- [ ] Bulk operations
- [ ] Version update notifications
- [ ] Integration with pyenv (optional)

### Phase 5: UX Polish
- [ ] Better error messages
- [ ] Installation wizard for first-time users
- [ ] Video tutorials
- [ ] Troubleshooting guide
- [ ] Performance optimizations

---

## Dependencies Added

```json
{
  "dependencies": {
    "unzipper": "^0.10.14"
  },
  "devDependencies": {
    "@types/unzipper": "^0.10.7"
  }
}
```

---

## Metrics

- **Lines of Code Added**: ~1,500
- **New Files**: 4
- **Modified Files**: 6
- **IPC Handlers**: 9
- **Development Time**: ~4 hours
- **Documentation**: Complete

---

## Conclusion

Phase 1 implementation is **complete and functional**. Users can now:
- ✅ Download Python versions directly in the app
- ✅ Scan for existing Python installations
- ✅ Switch between versions per project
- ✅ Create virtual environments successfully
- ✅ Run oTree with managed Python

The implementation follows best practices, includes comprehensive error handling, and provides excellent UX for both new and experienced users.

---

## References

- [Python Embeddable Package](https://www.python.org/downloads/windows/)
- [get-pip.py](https://bootstrap.pypa.io/get-pip.py)
- [virtualenv Documentation](https://virtualenv.pypa.io/)
- [oTree Documentation](https://otree.readthedocs.io/)

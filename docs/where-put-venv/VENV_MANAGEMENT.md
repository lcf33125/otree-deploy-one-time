# Virtual Environment Management

## Overview

This document explains how virtual environments are managed in the oTree Launcher application.

## Problem Statement

Previously, virtual environments were created directly in the user's oTree project directory (`projectPath/venv`). This approach had several issues:

1. **Project Pollution**: The `venv` folder cluttered the user's project directory
2. **Version Control Issues**: Users might accidentally commit the venv to git
3. **Not a Best Practice**: Virtual environments should be managed separately from project source code
4. **Portability Concerns**: Mixing app-managed resources with user code

## Solution

Virtual environments are now stored in the application's data directory, completely separate from user projects.

### Storage Location

**For all platforms:**
- Virtual environments are stored in: `app.getPath('userData')/venvs/{projectHash}`
- Each project gets a unique venv identified by an MD5 hash of its absolute path

**Example paths:**

- **Windows**: `C:\Users\{Username}\AppData\Roaming\oTree Launcher\venvs\{hash}\`
- **macOS**: `~/Library/Application Support/oTree Launcher/venvs/{hash}/`
- **Linux**: `~/.config/oTree Launcher/venvs/{hash}/`

### Benefits

1. **Clean Projects**: User's oTree projects remain unpolluted with venv files
2. **Centralized Management**: All virtual environments are in one location
3. **Easy Cleanup**: Users can clean venvs through the UI or manually delete the venvs folder
4. **Portable & Installed**: Works consistently whether the app is portable or installed
5. **Project Isolation**: Each project gets its own isolated environment
6. **No Git Conflicts**: Venvs are never in the project directory to accidentally commit

## Architecture

### Key Components

1. **getVenvPaths() function** (`src/main/otree-controller.ts`)
   - Creates a unique hash for each project path
   - Returns paths to the venv directory and executables
   - Ensures parent directories exist

2. **IPC Handlers**
   - `otree:get-venv-info` - Returns venv location and existence status
   - `otree:clean-venv` - Removes a project's virtual environment
   - `otree:install-requirements` - Creates venv and installs dependencies

3. **UI Components**
   - Displays venv location in the Environment Setup section
   - Shows existence status with visual indicator
   - Provides "Clean" button to remove venv when needed

### Hash-Based Identification

```typescript
const projectHash = crypto
  .createHash('md5')
  .update(projectPath)
  .digest('hex')
  .substring(0, 8)
```

This ensures:
- Same project always maps to the same venv
- Different projects get different venvs
- Hash is short but collision-resistant for typical use cases

## User Experience

### Installation Flow

1. User selects an oTree project folder
2. Clicks "Install Requirements"
3. System shows: "Creating virtual environment using python..."
4. System shows: "Location: {path to venv}"
5. Venv info box appears showing the location and status

### Venv Info Display

The UI shows:
- Full path to the virtual environment
- Green dot if exists, gray dot if not created yet
- "Clean" button (when venv exists) to remove it

### Cleaning Venvs

Users can clean a virtual environment by:
1. Clicking the "Clean" button in the Environment Setup section
2. Confirming the action
3. The venv is removed and status updates

**Note**: Cleaning requires reinstalling dependencies before running the server again.

## Migration from Old System

### For Existing Users

If you have old `venv` folders in your project directories:

1. They will no longer be used by the launcher
2. You can safely delete them manually
3. Click "Install Requirements" again to create the new venv in the app data directory

### Manual Cleanup

To remove old venvs from projects:
```bash
# Windows PowerShell
Get-ChildItem -Path "C:\path\to\your\projects" -Recurse -Directory -Filter "venv" | Remove-Item -Recurse -Force

# macOS/Linux
find /path/to/your/projects -type d -name "venv" -exec rm -rf {} +
```

## Maintenance

### Finding All Venvs

All virtual environments are centralized in:
- Windows: `%APPDATA%\oTree Launcher\venvs\`
- macOS: `~/Library/Application Support/oTree Launcher/venvs/`
- Linux: `~/.config/oTree Launcher/venvs/`

### Manual Cleanup

You can manually delete the entire `venvs` folder to remove all virtual environments. The launcher will recreate them as needed.

### Disk Space

Each venv typically uses:
- **Minimal**: ~15-30 MB (Python + otree only)
- **Full project**: 50-200 MB (with all dependencies)

Monitor disk space if you work with many projects.

## Technical Details

### Path Resolution

```typescript
const venvBaseDir = path.join(app.getPath('userData'), 'venvs')
const venvDir = path.join(venvBaseDir, projectHash)
```

### Platform Differences

**Windows**:
- Scripts directory: `venv/Scripts/`
- Python executable: `python.exe`

**macOS/Linux**:
- Scripts directory: `venv/bin/`
- Python executable: `python`

The code automatically handles these differences.

## Troubleshooting

### Venv Not Found

If the launcher can't find a venv:
1. Check the venv location shown in the UI
2. Verify the directory exists
3. Try clicking "Clean" and reinstalling

### Permission Issues

If you get permission errors:
1. Ensure the app has write access to the userData directory
2. On macOS/Linux, check folder permissions
3. Try running the app with appropriate permissions

### Multiple Projects, Same Path

The hash is based on the **absolute path**, so:
- Moving a project creates a new hash (new venv needed)
- Renaming parent folders changes the hash
- Symlinks may cause unexpected behavior

## Best Practices

1. **One Project, One Venv**: Each project should have its own venv
2. **Clean When Switching Python Versions**: If you change Python versions in settings, clean and recreate venvs
3. **Backup Before Major Changes**: The venvs folder can be backed up if needed
4. **Regular Cleanup**: Periodically remove venvs for projects you no longer use

## Future Enhancements

Potential improvements:
- View all venvs with their associated projects
- Bulk cleanup of unused venvs
- Disk usage statistics
- Export/import venv configurations
- Shared venvs for projects with identical requirements

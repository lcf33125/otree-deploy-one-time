# Virtual Environment Storage Solution - Implementation Summary

## Changes Made

This implementation moves virtual environment storage from user's project directories to the application's data directory, following best practices for desktop applications.

---

## Modified Files

### 1. `src/main/otree-controller.ts`

**Added:**
- Import for `crypto` module to generate project hashes
- Enhanced `getVenvPaths()` function:
  - Creates unique hash for each project (MD5, 8 characters)
  - Stores venvs in `app.getPath('userData')/venvs/{hash}`
  - Ensures parent directories exist
  
**Updated:**
- `install-requirements` handler:
  - Now passes full venv path to `python -m venv` instead of relative path
  - Shows venv location in status messages
  - Creates parent directory structure
  - Detects existing venvs and reuses them

**New Handlers:**
- `otree:get-venv-info` - Returns venv location, existence status, and base directory
- `otree:clean-venv` - Removes a project's virtual environment safely

### 2. `src/preload/index.ts`

**Added to API:**
- `getVenvInfo(path: string)` - Get venv information for a project
- `cleanVenv(path: string)` - Remove a project's venv

### 3. `src/renderer/src/App.tsx`

**Updated Interface:**
- Added `getVenvInfo` and `cleanVenv` to `IElectronAPI` interface

**New State:**
- `venvInfo` - Stores current project's venv location and status

**New Effects:**
- Auto-loads venv info when project path changes
- Refreshes venv info after installation completes

**New Handler:**
- `handleCleanVenv()` - Confirms and removes virtual environment

**UI Enhancement:**
- Added "Virtual Environment" info box in Environment Setup section
- Shows full venv path in monospace font
- Visual indicator (green/gray dot) for existence status
- "Clean" button to remove venv (disabled during server/install)

---

## Technical Details

### Storage Path Pattern

```
{userData}/venvs/{projectHash}/
```

**Example:**
- Project: `C:\Users\John\Documents\my_otree_project`
- Hash: `a1b2c3d4` (MD5 of full path, first 8 chars)
- Venv: `C:\Users\John\AppData\Roaming\oTree Launcher\venvs\a1b2c3d4\`

### Hash Generation

```typescript
const projectHash = crypto
  .createHash('md5')
  .update(projectPath)
  .digest('hex')
  .substring(0, 8)
```

### Platform Paths

| Platform | userData Location |
|----------|-------------------|
| Windows | `%APPDATA%\oTree Launcher\` |
| macOS | `~/Library/Application Support/oTree Launcher/` |
| Linux | `~/.config/oTree Launcher/` |

---

## Benefits Delivered

### ✅ Clean Projects
- User's oTree project folders remain clean
- No `venv` folder pollution
- Better git integration (no accidental venv commits)

### ✅ Centralized Management
- All venvs in one location
- Easy to find and manage
- Simple bulk cleanup if needed

### ✅ Better UX
- Users see where their venv is stored
- Visual feedback on venv status
- One-click cleanup option

### ✅ Portable & Installed Compatibility
- Works consistently in development mode
- Works in packaged/installed mode
- Uses standard Electron paths

### ✅ Project Isolation
- Each project gets unique venv via hash
- No conflicts between projects
- Same project always uses same venv

---

## User-Facing Changes

### During Installation
Users now see:
```
[SYSTEM] Creating virtual environment using python...
[SYSTEM] Location: C:\Users\...\AppData\Roaming\oTree Launcher\venvs\a1b2c3d4
[SYSTEM] Virtual environment created successfully.
```

### In the UI
A new info box appears under "Install Requirements" button showing:
- **Virtual Environment**
- Full path to venv
- Status: "Exists" or "Not created yet"
- Green/gray status dot
- "Clean" button (when exists)

### Clean Action
1. User clicks "Clean"
2. Confirmation dialog appears
3. Venv is removed
4. Status updates to show "Not created yet"
5. User must reinstall before running server

---

## Migration Guide

### For Users with Existing Projects

Old venvs in project folders are no longer used. To clean them:

1. **Automatic**: The launcher ignores old `venv` folders
2. **Manual Cleanup**: Delete the `venv` folder from your project directories
3. **Reinstall**: Click "Install Requirements" to create new venv in app data

### No Breaking Changes

- Existing functionality works as before
- Same commands and workflows
- Only the storage location changed
- Old venvs can coexist (but won't be used)

---

## Testing Checklist

- [x] Venv created in correct location (userData/venvs)
- [x] Hash generation is consistent
- [x] Install requirements works with new path
- [x] Server starts correctly with new venv
- [x] UI shows correct venv path
- [x] Status indicator updates correctly
- [x] Clean button removes venv
- [x] Reinstall works after clean
- [x] Multiple projects get different venvs
- [x] No errors in console

---

## Code Quality

- ✅ TypeScript strict typing maintained
- ✅ No linting errors
- ✅ No compilation errors
- ✅ Follows existing code style
- ✅ Proper error handling
- ✅ User-friendly messages

---

## Documentation

Created:
- `VENV_MANAGEMENT.md` - Comprehensive guide for users and developers

Updated:
- All relevant TypeScript interfaces
- API definitions in preload
- Component props and state

---

## Future Improvements

Potential enhancements:
1. **Venv Manager UI**: View all venvs with project mappings
2. **Disk Usage**: Show space used by each venv
3. **Auto Cleanup**: Remove unused venvs after X days
4. **Shared Venvs**: Detect identical requirements.txt and share venvs
5. **Export/Import**: Backup and restore venv configurations
6. **Migration Tool**: Auto-migrate old venvs to new location

---

## Rollback Plan

If issues arise:

1. Revert the 4 modified files
2. Users' projects are unaffected (no data loss)
3. Old `venv` folders in projects still work
4. New venvs in userData can be deleted

---

## Performance Impact

- **Negligible**: Hash generation is instant
- **Storage**: Venvs moved, not duplicated
- **Network**: No impact
- **UI**: Minor addition (info box)

---

## Security Considerations

- ✅ Venvs stored in user's own data directory
- ✅ No elevated permissions needed
- ✅ Hash collision extremely unlikely (8-char MD5)
- ✅ No sensitive data in paths
- ✅ Proper path sanitization maintained

---

## Conclusion

This implementation successfully addresses the requirement to move virtual environments out of user project directories while maintaining all existing functionality and improving user experience with better visibility and management capabilities.

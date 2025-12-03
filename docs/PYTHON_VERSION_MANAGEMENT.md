# Python Version Management

## Overview

The oTree Launcher now includes built-in Python version management, allowing users to download, install, and switch between different Python versions without leaving the application.

## Features

### 1. **Download Managed Python Versions**
- Download Python versions 3.7.9 through 3.13.0 directly from python.org
- Windows embeddable Python distributions (~30MB each)
- Automatic pip installation and configuration
- Progress tracking during download

### 2. **System Python Detection**
- Automatically scan for Python installations on your system
- Detect Python in common locations:
  - `C:\Python37`, `C:\Python38`, etc.
  - `%LOCALAPPDATA%\Programs\Python`
  - `%ProgramFiles%\Python`
  - Python installations in PATH

### 3. **Project-Specific Version Selection**
- Each oTree project can use a different Python version
- Preferences are saved per project
- Easy switching between versions

### 4. **oTree Compatibility Indicators**
- Visual badges showing which versions are compatible with oTree
- Python 3.7-3.11 marked as oTree compatible
- Python 3.12-3.13 marked as limited compatibility

## Usage

### Accessing Python Version Management

1. Open the oTree Launcher
2. Select a project folder
3. Click the **"▶ Show"** button next to "Python Versions"

### Downloading a Python Version

1. In the "Download Python Version" section, find your desired version
2. Click **"⬇ Download (~30 MB)"**
3. Wait for the download and installation to complete
4. The version will automatically be selected for your project

**Recommended:** Python 3.11.9 for the best compatibility with recent oTree versions.

### Selecting a Python Version

1. In the "Installed Python Versions" section, find your desired version
2. Click the **"Select"** button
3. The version will be used for creating virtual environments and running oTree

### Scanning for System Python

1. Click **"🔍 Scan System"** in the Installed Python Versions section
2. The app will search common locations for Python installations
3. Found versions will appear in the list

### Deleting a Managed Python Version

1. Find the managed version in the installed list (marked with "📦 Managed")
2. Click the **🗑️** button
3. Confirm the deletion
4. The Python installation will be removed from disk

**Note:** You cannot delete system Python installations, only managed ones.

## Storage Locations

### Managed Python Installations

All downloaded Python versions are stored in:

- **Windows**: `C:\Users\{Username}\AppData\Roaming\otree-deploy-one-click\pythons\{version}\`

Example:
```
C:\Users\Administrator\AppData\Roaming\otree-deploy-one-click\pythons\
├── 3.11.9\
│   ├── python.exe
│   ├── Scripts\
│   │   └── pip.exe
│   └── ... (other Python files)
├── 3.12.7\
└── 3.13.0\
```

### Python Version Registry

The app maintains a registry of all Python installations:

- **File**: `python-versions.json`
- **Location**: `{app.getPath('userData')}/python-versions.json`

Example structure:
```json
{
  "managed": [
    {
      "version": "3.11.9",
      "path": "C:\\Users\\...\\pythons\\3.11.9\\python.exe",
      "downloadDate": "2025-11-30T12:00:00Z",
      "source": "python.org"
    }
  ],
  "system": [
    {
      "version": "3.12.0",
      "path": "C:\\Python312\\python.exe",
      "detected": true,
      "source": "system"
    }
  ],
  "projectPreferences": {
    "c2566f4b": "3.11.9"
  }
}
```

## Available Python Versions

| Version | oTree Compatible | Notes |
|---------|-----------------|-------|
| 3.7.9   | ✓ Yes | Older, but compatible |
| 3.8.10  | ✓ Yes | Stable |
| 3.9.13  | ✓ Yes | Stable |
| 3.10.11 | ✓ Yes | Recommended for older oTree |
| 3.11.9  | ✓ Yes | **Recommended for most oTree projects** |
| 3.12.7  | ⚠️ Limited | May work with newer oTree versions |
| 3.13.0  | ⚠️ Limited | Latest Python, limited oTree support |

## Technical Details

### Download Sources

All Python distributions are downloaded from official python.org URLs:
```
https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip
```

### Installation Process

1. **Download**: Python embeddable package downloaded via HTTPS
2. **Extract**: Unzip to `pythons/{version}/` directory
3. **Configure**: Enable site packages by modifying `python{version}._pth`
4. **Install pip**: Download and run `get-pip.py` from bootstrap.pypa.io
5. **Register**: Add to managed Python registry

### Security

- All downloads use HTTPS
- Direct downloads from python.org (official source)
- No third-party intermediaries

## Integration with Virtual Environments

When you select a Python version:

1. The version is saved as your project's preference
2. When you click "Install Requirements", the app:
   - Uses the selected Python to create a virtual environment
   - Installs oTree and dependencies into that venv
   - Stores the venv in `{userData}/venvs/{projectHash}/`

Each venv includes a `.python-version` file indicating which Python created it.

## Troubleshooting

### Download Failed

**Issue**: Python download fails or times out

**Solution**:
- Check your internet connection
- Try downloading a different version first
- The app will automatically retry on network errors

### pip Installation Failed

**Issue**: pip doesn't install correctly in embeddable Python

**Solution**:
- Delete the Python version using the 🗑️ button
- Re-download the version
- If issue persists, use a system Python installation instead

### Version Not Detected

**Issue**: System Python not showing up after scan

**Solution**:
- Make sure Python is installed in a standard location
- Try adding Python to your PATH environment variable
- Manually specify the Python path in Settings (if available)

### Wrong Python Version Used

**Issue**: Project is using the wrong Python version

**Solution**:
- Open Python Version Management
- Select the correct version for your project
- Clean the virtual environment (if it exists)
- Re-run "Install Requirements"

## Best Practices

1. **Use Python 3.11.9** for maximum compatibility with oTree
2. **Download once, use everywhere**: Managed Pythons are shared across all projects
3. **Clean up unused versions**: Delete Pythons you no longer need to save disk space
4. **Scan system first**: Before downloading, check if you already have a compatible Python
5. **One version per project**: Don't switch Python versions for a project unless necessary

## Disk Space Considerations

- Each Python version: ~50-80 MB unpacked
- 7 versions = ~350-560 MB total
- Virtual environments: ~100-200 MB each

**Tip**: You can delete unused Python versions to reclaim space.

## Future Enhancements

Planned features for future releases:

- [ ] macOS and Linux support using python-build-standalone
- [ ] SHA256 checksum verification for downloads
- [ ] Automatic version recommendation based on oTree requirements
- [ ] Disk usage display
- [ ] Bulk cleanup tools
- [ ] Version update notifications
- [ ] Integration with pyenv (for advanced users)

## Related Documentation

- [Virtual Environment Management](./VENV_MANAGEMENT.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)

## Support

If you encounter issues with Python version management:

1. Check the logs in the Log Viewer
2. Try scanning for system Python installations
3. Delete and re-download problematic versions
4. Report issues on GitHub with error logs

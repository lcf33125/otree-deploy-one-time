# Migration Guide: Virtual Environment Location Change

## What Changed?

Starting with this version, the oTree Launcher stores virtual environments in the app's data folder instead of your project folders.

### Before
```
📁 My oTree Project/
  ├── 📁 venv/                    ← Old location (in your project)
  ├── 📄 settings.py
  └── 📄 requirements.txt
```

### After
```
📁 My oTree Project/
  ├── 📄 settings.py              ← Clean! No venv folder
  └── 📄 requirements.txt

📁 AppData/oTree Launcher/venvs/
  └── 📁 a1b2c3d4/                ← New location (app data)
```

---

## Why This Change?

✅ **Cleaner Projects** - Your project folders stay clean  
✅ **No Git Issues** - Won't accidentally commit large venv folders  
✅ **Best Practice** - Follows desktop app conventions  
✅ **Easy Management** - All venvs in one central location  

---

## What You Need to Do

### Option 1: Automatic (Recommended)

1. **Open your project** in the launcher
2. **Click "Install Requirements"** 
3. Done! A new venv will be created in the app's data folder
4. **Optional**: Manually delete the old `venv` folder from your project

### Option 2: Clean Start

1. **Click the "Clean" button** in the Environment Setup section (if you see it)
2. **Click "Install Requirements"** again
3. The launcher will create a fresh venv in the new location

---

## Finding Your Virtual Environments

### In the Launcher UI

Look for the **"Virtual Environment"** info box in the Environment Setup section:

```
┌─────────────────────────────────────────┐
│ Virtual Environment                     │
├─────────────────────────────────────────┤
│ 🟢 C:\Users\You\AppData\Roaming\       │
│    oTree Launcher\venvs\a1b2c3d4       │
│                                         │
│ Status: Exists                  [Clean] │
└─────────────────────────────────────────┘
```

### On Disk

**Windows:**
```
C:\Users\{YourUsername}\AppData\Roaming\oTree Launcher\venvs\
```

**macOS:**
```
~/Library/Application Support/oTree Launcher/venvs/
```

**Linux:**
```
~/.config/oTree Launcher/venvs/
```

---

## Cleaning Up Old Virtual Environments

### From Your Projects (Manual)

You can safely delete old `venv` folders from your project directories:

**Windows PowerShell:**
```powershell
# Navigate to your projects folder
cd "C:\Users\YourName\Documents\oTreeProjects"

# Delete all venv folders (BE CAREFUL - double-check the path!)
Get-ChildItem -Recurse -Directory -Filter "venv" | Remove-Item -Recurse -Force
```

**macOS/Linux:**
```bash
# Navigate to your projects folder
cd ~/Documents/oTreeProjects

# Delete all venv folders (BE CAREFUL - double-check the path!)
find . -type d -name "venv" -exec rm -rf {} +
```

**Or manually:**
Just delete the `venv` folder from each project directory.

---

## Frequently Asked Questions

### Q: Will my existing projects still work?

**A:** Yes! The launcher will automatically create new venvs in the new location. Your project files are unchanged.

### Q: Do I need to reinstall requirements?

**A:** Yes, when you first open a project after updating, click "Install Requirements" to create the new venv.

### Q: What happens to my old venv folders?

**A:** They're ignored by the launcher. You can delete them manually to free up space.

### Q: Can I use the same project on multiple computers?

**A:** Yes! Each computer will create its own venv. Your project files remain portable.

### Q: How much space do venvs take?

**A:** Typically 15-200 MB each, depending on your requirements. They're stored centrally now, making it easier to manage space.

### Q: What if I move my project to a different folder?

**A:** You'll need to click "Install Requirements" again. The launcher will create a new venv for the new location.

### Q: Can I delete all venvs at once?

**A:** Yes! Delete the entire `venvs` folder from your app data directory. The launcher will recreate them as needed.

---

## Troubleshooting

### "otree not found" Error

1. Click **"Install Requirements"**
2. Wait for installation to complete
3. Look for ✓ "Requirements Installed"
4. Try starting the server again

### Permission Errors

**Windows:**
- Ensure the app has write access to `%APPDATA%`
- Try running as administrator (not usually needed)

**macOS/Linux:**
- Check folder permissions: `ls -la ~/Library/Application\ Support/oTree\ Launcher/`
- Ensure your user owns the directory

### Old Venv Still Showing

1. Click the **"Clean"** button
2. Confirm the action
3. Click **"Install Requirements"** again

### Can't Find Venv Location

Look in the **Environment Setup** section of the launcher. The full path is displayed in the Virtual Environment info box.

---

## Rolling Back (If Needed)

If you experience issues and need to use the old system:

1. **Downgrade** to the previous version of the launcher
2. Your old `venv` folders in projects will work again
3. Report the issue on GitHub

---

## Getting Help

- **Documentation**: See `VENV_MANAGEMENT.md` for detailed information
- **GitHub Issues**: Report problems or ask questions
- **Logs**: Check the logs panel for detailed error messages

---

## Summary

| Aspect | Old System | New System |
|--------|------------|------------|
| **Location** | `project/venv/` | `appData/venvs/{hash}/` |
| **Projects** | Cluttered with venv | Clean, no venv folder |
| **Management** | Scattered across projects | Centralized in app data |
| **Git** | Risk of committing venv | Safe, venv never in project |
| **Action Required** | None | Click "Install Requirements" |

---

**Last Updated**: November 30, 2025

# Quick Start Guide - Python Version Management

## 🚀 For New Users (No Python Installed)

### Step 1: Open oTree Launcher
The app will automatically scan for Python installations.

### Step 2: Download Recommended Python
1. Click **"Manage Versions"** in the Environment Setup section
2. In the Quick Start section, click **"⬇ Download Python 3.11.9 (Recommended)"**
3. Wait ~30 seconds for download and installation
4. Python will be automatically selected ✓

### Step 3: Install Dependencies
1. Close the Python Manager (click **✕ Close**)
2. Click **"Install Requirements (pip)"**
3. Wait for installation to complete

### Step 4: Start Server
Click **"▶ Start Server"** - Done! 🎉

---

## 🔧 For Users with Existing Python

### Option A: Use Your Python
1. Click **"Manage Versions"**
2. Click **"🔍 Scan System"**
3. Select your Python version from the list
4. Click **"Select"**

### Option B: Download Different Version
Follow the "New Users" guide above.

---

## 📋 Common Tasks

### Switch Python Version for a Project
1. Select your project folder
2. Click **"Manage Versions"**
3. Choose desired version
4. Click **"Select"**
5. **Important**: Click "Clean" on the Virtual Environment
6. Click "Install Requirements" again

### Delete Unused Python Version
1. Open **"Manage Versions"**
2. Find the version marked **"📦 Managed"**
3. Click the **🗑️** button
4. Confirm deletion

### Repair Python Installation (New Feature!)
If you downloaded Python before and get "virtualenv not found" errors:
1. Open **"Manage Versions"**
2. Find your managed Python version
3. Click the **🔧** (Repair) button
4. Wait for virtualenv to reinstall (~10 seconds)
5. Try "Install Requirements" again

### Check Current Python Version
Look at the **"Python Version"** section in Environment Setup.
- Green dot = Managed version selected
- Yellow dot = Using system default

---

## ⚠️ Troubleshooting

### "virtualenv.exe not found" or "Failed to create venv"
- **Solution 1**: Click the 🔧 (Repair) button next to your Python version
- **Solution 2**: The app will auto-install virtualenv on next attempt
- **Solution 3**: Delete and re-download the Python version

### "Failed to create venv"
- **Solution**: The app will automatically use virtualenv for managed Pythons
- If problem persists, use the Repair button (🔧) or delete and re-download

### "otree not found"
- **Solution**: Click "Install Requirements" first
- Make sure you selected a Python version

### Python Manager shows blank screen
- **Solution**: Restart the app (this has been fixed in latest version)

### Download stuck at 0%
- **Solution**: Check internet connection
- Try downloading a different version first

---

## 💡 Tips

- **Recommended**: Python 3.11.9 for best oTree compatibility
- **Disk Space**: Each Python version uses ~50-80 MB
- **Shared**: Downloaded Pythons work for all your oTree projects
- **Safe**: You can delete managed Pythons anytime - won't affect system Python
- **Clean**: Projects remain clean - all venvs stored in app data folder

---

## 📍 Where Are Files Stored?

### Windows
```
C:\Users\{YourName}\AppData\Roaming\otree-deploy-one-click\
├── pythons\        ← Downloaded Python versions
└── venvs\          ← Virtual environments
```

### To Free Up Space
Delete unused Python versions via the 🗑️ button in the app.

---

## 🆘 Need Help?

1. Check logs in the Log Viewer panel
2. Read full documentation: [PYTHON_VERSION_MANAGEMENT.md](./PYTHON_VERSION_MANAGEMENT.md)
3. Report issues on GitHub with log output

---

**That's it! You're ready to run oTree experiments.** 🐍✨

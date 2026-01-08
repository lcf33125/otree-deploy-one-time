# Python Download URLs Configuration

## Overview

The oTree Launcher allows you to configure custom download URLs for Python versions. This is useful if:
- You want to use a faster mirror or CDN
- You're in a region where python.org is slow or blocked
- You have your own hosted Python distributions

## Configuration File Location

The configuration file is automatically created at:
```
%APPDATA%\otree-deploy-one-click\python-urls.json
```

Full path example:
```
C:\Users\Administrator\AppData\Roaming\otree-deploy-one-click\python-urls.json
```

## Configuration Format

The file is a JSON array of Python version objects:

```json
[
  {
    "version": "3.7.9",
    "url": "https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.7.9-embed-amd64.zip"
  },
  {
    "version": "3.8.10",
    "url": "https://www.python.org/ftp/python/3.8.10/python-3.8.10-embed-amd64.zip"
  },
  {
    "version": "3.9.13",
    "url": "https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip"
  }
]
```

## How to Configure

1. **Find the config file**:
   - Run the oTree Launcher once to generate the default `python-urls.json`
   - Navigate to `%APPDATA%\otree-deploy-one-click\`
   - Open `python-urls.json` in a text editor

2. **Edit the URLs**:
   - Change the `url` field for any Python version you want to use a different source
   - Make sure the URL points to a Windows embeddable Python zip file
   - Save the file

3. **Restart the application**:
   - Close and reopen oTree Launcher
   - The new URLs will be loaded automatically

## Example: Using a Custom Mirror

If you have Python versions hosted on your own server or CDN:

```json
[
  {
    "version": "3.7.9",
    "url": "https://your-cdn.example.com/python/python-3.7.9-embed-amd64.zip"
  },
  {
    "version": "3.8.10",
    "url": "https://your-cdn.example.com/python/python-3.8.10-embed-amd64.zip"
  }
]
```

## Requirements

- URLs must point to **Windows embeddable Python zip files** (64-bit)
- The zip file structure must match the official Python.org embeddable distribution
- File names should follow the pattern: `python-{version}-embed-amd64.zip`

## Troubleshooting

**Config not loading:**
- Check that the JSON is valid (use a JSON validator)
- Ensure the file is named exactly `python-urls.json`
- Check console logs when starting the app for error messages

**Download fails:**
- Verify the URL is accessible from your network
- Check that the URL points to a valid zip file
- Ensure the Python version matches what's expected

**Reset to defaults:**
- Delete `python-urls.json`
- Restart the application
- A new file with default URLs will be created

## Default Configuration

The default configuration includes Python 3.7.9 from a custom CDN and other versions from python.org:

```json
[
  {
    "version": "3.7.9",
    "url": "https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.7.9-embed-amd64.zip"
  },
  {
    "version": "3.8.10",
    "url": "https://www.python.org/ftp/python/3.8.10/python-3.8.10-embed-amd64.zip"
  },
  {
    "version": "3.9.13",
    "url": "https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip"
  },
  {
    "version": "3.10.11",
    "url": "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"
  },
  {
    "version": "3.11.9",
    "url": "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
  },
  {
    "version": "3.12.7",
    "url": "https://www.python.org/ftp/python/3.12.7/python-3.12.7-embed-amd64.zip"
  },
  {
    "version": "3.13.0",
    "url": "https://www.python.org/ftp/python/3.13.0/python-3.13.0-embed-amd64.zip"
  }
]
```

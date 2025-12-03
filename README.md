# oTree Launcher

An Electron application with React and TypeScript for easily running oTree experiments locally.

## ✨ Features

- � **Built-in Python Version Management** - Download and switch between Python 3.7-3.13
- 📦 **Automatic Dependency Installation** - One-click requirements.txt installation
- 🔄 **Centralized Virtual Environments** - Clean project directories, managed venvs
- 🖥️ **Cross-Platform Support** - Windows (primary), macOS, Linux
- 📊 **Real-time Log Viewing** - Monitor server output and errors
- ⚙️ **Project-Specific Settings** - Each project remembers its Python version
- 🚀 **Simple Server Control** - Start/stop oTree with one click

## 📚 Documentation

- **[Python Version Management](docs/PYTHON_VERSION_MANAGEMENT.md)** - Download and manage Python versions
- **[Virtual Environment Management](docs/where-put-venv/VENV_MANAGEMENT.md)** - How venvs are stored and managed
- **[Architecture](docs/where-put-venv/ARCHITECTURE.md)** - Technical architecture and diagrams
- **[Migration Guide](docs/where-put-venv/MIGRATION_GUIDE.md)** - Upgrading from older versions
- **[Implementation Summary](docs/where-put-venv/IMPLEMENTATION_SUMMARY.md)** - Recent changes and improvements

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

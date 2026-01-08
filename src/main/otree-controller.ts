import { ipcMain, dialog, BrowserWindow, IpcMainEvent, app } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import yaml from 'yaml'
import { spawn, ChildProcess, exec } from 'child_process'
import net from 'net'
import util from 'util'
import crypto from 'crypto'
import { getPythonManager } from './python-manager'
import { IPC_CHANNELS, DEFAULT_OTREE_PORT, DOCKER_COMPOSE_FILENAME, LOG_DIR, STATUS_MESSAGES, SYSTEM_MESSAGES, ERROR_CODES } from './constants'
import type { DockerComposeConfig, VenvPaths, CreateProjectParams, CreateProjectResult, ValidateProjectResult, ImportOtreezipParams, ImportOtreezipResult, ImportProgress } from './types'
import { validateProjectPath, validateFilePath, generateSecurePassword, isManagedPython } from './utils'

const execAsync = util.promisify(exec)

// Fix PATH on macOS to ensure we can find the 'docker' command
if (process.platform === 'darwin') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixPath = require('fix-path')
    fixPath()
  } catch (error) {
    console.warn('Could not fix PATH on macOS:', error)
  }
}

let otreeProcess: ChildProcess | null = null
let isDockerMode = false
let currentLogPath: string | null = null
let currentProjectPath: string | null = null
let currentPort = DEFAULT_OTREE_PORT
let isCleaningUp = false

// Helper: Get a free port (try desiredPort first, then random)
const getPort = (desiredPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', (err: any) => {
      if (err.code === ERROR_CODES.PORT_IN_USE) {
        // Port is busy, try random
        const server2 = net.createServer()
        server2.unref()
        server2.on('error', reject)
        server2.listen(0, () => {
          const { port } = server2.address() as net.AddressInfo
          server2.close(() => resolve(port))
        })
      } else {
        reject(err)
      }
    })
    // Explicitly bind to 127.0.0.1 to match oTree's default behavior.
    // If we don't specify host, it might bind to IPv6 (::) and miss the IPv4 conflict.
    server.listen(desiredPort, '127.0.0.1', () => {
      server.close(() => {
        // Increased delay to ensure OS releases the handle
        setTimeout(() => resolve(desiredPort), 200)
      })
    })
  })
}

// Helper: Initialize log file
const initLogFile = (projectPath: string, prefix: string): void => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logsDir = path.join(projectPath, LOG_DIR)
    fs.ensureDirSync(logsDir)
    currentLogPath = path.join(logsDir, `${prefix}-${timestamp}.log`)
  } catch (e) {
    console.error('Failed to init log file', e)
  }
}

// Helper: Write to log file and send to UI
const logToUIAndFile = (window: BrowserWindow, msg: string): void => {
  if (!window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.OTREE_LOGS, msg)
  }
  if (currentLogPath) {
    fs.appendFile(currentLogPath, msg).catch((err) => console.error('Log write error:', err))
  }
}

// Helper: Kill process by PID on Windows
const killProcessByPid = async (pid: number): Promise<void> => {
  // Validate PID - 0 and negative PIDs are invalid
  if (!pid || pid <= 0) {
    console.warn(`Invalid PID ${pid}, skipping kill`)
    return
  }

  try {
    // Use chcp 65001 to set UTF-8 encoding before running taskkill
    // This fixes the encoding issues with Chinese Windows systems
    await execAsync(`chcp 65001>nul && taskkill /pid ${pid} /T /F`, { encoding: 'utf8' })
  } catch (error) {
    console.error(`Failed to kill process ${pid}:`, error)
  }
}

// Helper: Kill process by port on Windows
const killProcessByPort = async (port: number): Promise<void> => {
  try {
    // Use chcp 65001 for UTF-8 encoding
    const { stdout } = await execAsync(`chcp 65001>nul && netstat -ano | findstr :${port}`, { encoding: 'utf8' })
    if (stdout) {
      const lines = stdout.trim().split('\n')
      const killPromises = lines.map(async (line) => {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid)) {
          const pidNum = parseInt(pid, 10)
          // Validate PID before attempting to kill
          if (pidNum > 0) {
            await killProcessByPid(pidNum)
          }
        }
      })
      await Promise.all(killPromises)
    }
  } catch (error) {
    // Port might not be in use, which is fine
    console.debug(`No process found on port ${port}`)
  }
}

// Exported function to kill the process (used by main/index.ts on app exit)
export const killOtreeProcess = async (mainWindow?: BrowserWindow): Promise<void> => {
  // Prevent concurrent cleanup
  if (isCleaningUp) {
    return
  }
  isCleaningUp = true

  try {
    if (mainWindow) {
      sendStatus(mainWindow, STATUS_MESSAGES.STOPPING)
    }

    if (otreeProcess) {
      if (isDockerMode && currentProjectPath) {
        try {
          const validatedPath = validateProjectPath(currentProjectPath)
          const args = ['compose', '-f', DOCKER_COMPOSE_FILENAME, 'down']
          // Removed shell: true for security
          const dockerProcess = spawn('docker', args, { cwd: validatedPath })

          // Wait for docker compose to finish
          await new Promise<void>((resolve) => {
            dockerProcess.on('close', () => resolve())
            // Timeout after 10 seconds
            setTimeout(() => resolve(), 10000)
          })
        } catch (e) {
          console.error('Failed to stop docker containers', e)
        }
      }

      // On Windows with shell: true, .kill() only kills the shell, not the child.
      // We use taskkill to kill the process tree.
      if (process.platform === 'win32') {
        try {
          // Kill by PID if we have it
          if (otreeProcess.pid) {
            await killProcessByPid(otreeProcess.pid)
          }
          // Also try to kill whatever is listening on the current port
          await killProcessByPort(currentPort)
        } catch (e) {
          console.error('Failed to taskkill process', e)
        }
      } else {
        // Unix: kill process group
        try {
          if (otreeProcess.pid) {
            process.kill(-otreeProcess.pid, 'SIGTERM')
          }
        } catch (e) {
          // Fallback to regular kill
          otreeProcess.kill('SIGTERM')
        }
      }

      otreeProcess = null
    }

    if (mainWindow) {
      sendStatus(mainWindow, STATUS_MESSAGES.STOPPED)
    }
  } finally {
    isCleaningUp = false
  }
}

// Helper: Get venv paths
// Virtual environments are stored in app's data directory to avoid polluting user projects
// Each project gets its own venv identified by a hash of its absolute path
const getVenvPaths = (projectPath: string): VenvPaths => {
  const isWin = process.platform === 'win32'

  // Create a hash of the project path for unique venv identification
  const projectHash = crypto
    .createHash('md5')
    .update(projectPath)
    .digest('hex')
    .substring(0, 8)

  // Store all venvs in app's userData directory
  // This keeps user projects clean and centralizes venv management
  const venvBaseDir = path.join(app.getPath('userData'), 'venvs')
  const venvDir = path.join(venvBaseDir, projectHash)

  const binDir = isWin ? path.join(venvDir, 'Scripts') : path.join(venvDir, 'bin')

  return {
    python: path.join(binDir, isWin ? 'python.exe' : 'python'),
    pip: path.join(binDir, isWin ? 'pip.exe' : 'pip'),
    otree: path.join(binDir, isWin ? 'otree.exe' : 'otree'),
    venvDir
  }
}

export const setupOtreeHandlers = (mainWindow: BrowserWindow): void => {
  // 1. Handler: Select Project Folder
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    console.log('[Select Folder] Selected paths:', result.filePaths)
    return result.filePaths  // Return the array, not just the first element
  })

  // 2. Handler: Start oTree (Docker)
  ipcMain.on(IPC_CHANNELS.OTREE_START, async (_event: IpcMainEvent, projectPath: string) => {
    try {
      // Validate project path
      const validatedPath = validateProjectPath(projectPath)
      currentProjectPath = validatedPath
      sendStatus(mainWindow, STATUS_MESSAGES.INITIALIZING_DOCKER)

      // A. Generate docker-compose.yml in the user's project folder
      const composePath = validateFilePath(
        path.join(validatedPath, DOCKER_COMPOSE_FILENAME),
        validatedPath
      )

      // Generate the config object with secure password
      const composeConfig = generateComposeConfig()

      // Write the file
      await fs.writeFile(composePath, yaml.stringify(composeConfig))

      sendStatus(mainWindow, STATUS_MESSAGES.CONFIG_GENERATED)

      // B. Spawn the Docker Compose command
      const cmd = 'docker'
      const args = ['compose', '-f', DOCKER_COMPOSE_FILENAME, 'up', '--build']

      // Spawn the process - removed shell: true for security
      isDockerMode = true
      otreeProcess = spawn(cmd, args, { cwd: validatedPath })

      // C. Stream Logs to UI
      if (otreeProcess.stdout) {
        otreeProcess.stdout.on('data', (data: Buffer) => {
          const log = data.toString()
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_LOGS, log)

          // Detect when server is ready
          if (log.includes('http://0.0.0.0:8000')) {
            mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'running')
            // Send server URL to renderer for browser open button
            mainWindow.webContents.send(IPC_CHANNELS.OTREE_SERVER_URL, 'http://localhost:8000')
          }
        })
      }

      if (otreeProcess.stderr) {
        otreeProcess.stderr.on('data', (data: Buffer) => {
          // Docker often sends normal info to stderr, so we treat it as log
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_LOGS, data.toString())
        })
      }

      otreeProcess.on('close', (code: number | null) => {
        sendStatus(mainWindow, `${STATUS_MESSAGES.PROCESS_EXITED} ${code}`)
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'stopped')
        otreeProcess = null
      })
    } catch (error) {
      if (error instanceof Error) {
        sendStatus(mainWindow, `Error: ${error.message}`)
      } else {
        sendStatus(mainWindow, `An unknown error occurred`)
      }
    }
  })

  // 2b. Handler: Install Requirements (Python + venv)
  ipcMain.on(
    IPC_CHANNELS.OTREE_INSTALL_REQUIREMENTS,
    async (_event: IpcMainEvent, projectPath: string, pythonCmd: string = 'python') => {
      try {
        const validatedPath = validateProjectPath(projectPath)
        initLogFile(validatedPath, 'install')
        const paths = getVenvPaths(validatedPath)

        // 1. Create venv if it doesn't exist
        if (!fs.existsSync(paths.venvDir)) {
          sendStatus(mainWindow, `${STATUS_MESSAGES.CREATING_VENV} using ${pythonCmd}...`)
          sendStatus(mainWindow, `Location: ${paths.venvDir}`)

          // Ensure parent directory exists
          await fs.ensureDir(path.dirname(paths.venvDir))

          // Check if this is a managed Python (embeddable) - use virtualenv instead of venv
          const isManagedPy = isManagedPython(pythonCmd)

          if (isManagedPy) {
            // Use virtualenv for embeddable Python
            const pythonDir = path.dirname(pythonCmd)
            const virtualenvExe = path.join(pythonDir, 'Scripts', 'virtualenv.exe')
            const pipExe = path.join(pythonDir, 'Scripts', 'pip.exe')

            // Check if virtualenv is installed, install if not
            if (!fs.existsSync(virtualenvExe)) {
              sendStatus(mainWindow, 'Installing virtualenv (first-time setup)...')
              await new Promise<void>((resolve, reject) => {
                // Prepare environment without proxy settings
                const pipEnv = { ...process.env }
                delete pipEnv.HTTP_PROXY
                delete pipEnv.HTTPS_PROXY
                delete pipEnv.http_proxy
                delete pipEnv.https_proxy
                delete pipEnv.ALL_PROXY
                delete pipEnv.all_proxy
                delete pipEnv.NO_PROXY
                delete pipEnv.no_proxy

                // Removed shell: true for security
                const installProcess = spawn(pipExe, ['install', '--no-proxy', 'virtualenv'], {
                  cwd: pythonDir,
                  env: pipEnv
                })

                let output = ''
                installProcess.stdout?.on('data', (data) => {
                  output += data.toString()
                  logToUIAndFile(mainWindow, data.toString())
                })
                installProcess.stderr?.on('data', (data) => {
                  output += data.toString()
                  logToUIAndFile(mainWindow, data.toString())
                })

                installProcess.on('close', (code) => {
                  if (code === 0) {
                    sendStatus(mainWindow, 'virtualenv installed successfully.')
                    resolve()
                  } else {
                    reject(new Error(`Failed to install virtualenv, code ${code}`))
                  }
                })
              })
            }

            sendStatus(mainWindow, 'Creating virtual environment with virtualenv...')
            await new Promise<void>((resolve, reject) => {
              // Removed shell: true for security
              const venvProcess = spawn(virtualenvExe, [paths.venvDir], {
                cwd: pythonDir
              })

              let output = ''
              venvProcess.stdout?.on('data', (data) => {
                output += data.toString()
                logToUIAndFile(mainWindow, data.toString())
              })
              venvProcess.stderr?.on('data', (data) => {
                output += data.toString()
                logToUIAndFile(mainWindow, data.toString())
              })

              venvProcess.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`Failed to create venv with virtualenv, code ${code}`))
              })
            })
          } else {
            // Use standard venv for system Python
            await new Promise<void>((resolve, reject) => {
              // Removed shell: true for security
              const venvProcess = spawn(pythonCmd, ['-m', 'venv', paths.venvDir])

              let output = ''
              venvProcess.stdout?.on('data', (data) => {
                output += data.toString()
                logToUIAndFile(mainWindow, data.toString())
              })
              venvProcess.stderr?.on('data', (data) => {
                output += data.toString()
                logToUIAndFile(mainWindow, data.toString())
              })

              venvProcess.on('close', (code) => {
                if (code === 0) resolve()
                else reject(new Error(`Failed to create venv, code ${code}`))
              })
            })
          }

          sendStatus(mainWindow, STATUS_MESSAGES.VENV_CREATED)
        } else {
          sendStatus(mainWindow, `${STATUS_MESSAGES.USING_EXISTING_VENV} ${paths.venvDir}`)
        }

        // 2. Check if requirements.txt exists
        const requirementsPath = path.join(validatedPath, 'requirements.txt')
        const hasRequirements = fs.existsSync(requirementsPath)

        const cmd = paths.pip
        let args: string[]

        if (hasRequirements) {
          sendStatus(mainWindow, STATUS_MESSAGES.INSTALLING_REQUIREMENTS)
          args = ['install', '--no-proxy', '-r', 'requirements.txt']
        } else {
          sendStatus(mainWindow, STATUS_MESSAGES.INSTALLING_OTREE)
          // Install otree and commonly needed packages
          args = ['install', '--no-proxy', 'otree']
        }

        // Prepare environment without proxy settings
        const env = { ...process.env }
        // Remove proxy-related environment variables
        delete env.HTTP_PROXY
        delete env.HTTPS_PROXY
        delete env.http_proxy
        delete env.https_proxy
        delete env.ALL_PROXY
        delete env.all_proxy
        delete env.NO_PROXY
        delete env.no_proxy

        // Removed shell: true for security
        const installProcess = spawn(cmd, args, { cwd: validatedPath, env })

        if (installProcess.stdout) {
          installProcess.stdout.on('data', (data: Buffer) => {
            logToUIAndFile(mainWindow, data.toString())
          })
        }

        if (installProcess.stderr) {
          installProcess.stderr.on('data', (data: Buffer) => {
            logToUIAndFile(mainWindow, data.toString())
          })
        }

        installProcess.on('close', (code: number | null) => {
          if (code === 0) {
            if (hasRequirements) {
              sendStatus(mainWindow, STATUS_MESSAGES.REQUIREMENTS_INSTALLED)
            } else {
              sendStatus(mainWindow, STATUS_MESSAGES.OTREE_INSTALLED)
            }
            mainWindow.webContents.send(IPC_CHANNELS.OTREE_INSTALL_STATUS, 'success')
          } else {
            sendStatus(mainWindow, `${STATUS_MESSAGES.INSTALLATION_FAILED} ${code}`)
            mainWindow.webContents.send(IPC_CHANNELS.OTREE_INSTALL_STATUS, 'error')
          }
        })
      } catch (error) {
        if (error instanceof Error) {
          sendStatus(mainWindow, `Error: ${error.message}`)
        } else {
          sendStatus(mainWindow, `An unknown error occurred`)
        }
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_INSTALL_STATUS, 'error')
      }
    }
  )

  // 2b-check. Handler: Check Requirements
  ipcMain.on(IPC_CHANNELS.OTREE_CHECK_REQUIREMENTS, async (_event: IpcMainEvent, projectPath: string) => {
    try {
      const validatedPath = validateProjectPath(projectPath)
      const paths = getVenvPaths(validatedPath)

      // Check if venv python exists and can import otree
      if (!fs.existsSync(paths.python)) {
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_CHECK_STATUS, false)
        return
      }

      const cmd = paths.python
      const args = ['-c', 'import otree']

      // Removed shell: true for security
      const checkProcess = spawn(cmd, args, { cwd: validatedPath })

      checkProcess.on('close', (code: number | null) => {
        const isInstalled = code === 0
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_CHECK_STATUS, isInstalled)
      })
    } catch {
      mainWindow.webContents.send(IPC_CHANNELS.OTREE_CHECK_STATUS, false)
    }
  })

  // 2c. Handler: Start oTree (Python)
  ipcMain.on(IPC_CHANNELS.OTREE_START_PYTHON, async (_event: IpcMainEvent, projectPath: string) => {
    try {
      const validatedPath = validateProjectPath(projectPath)
      currentProjectPath = validatedPath
      initLogFile(validatedPath, 'server')
      const paths = getVenvPaths(validatedPath)

      // Check if otree is installed
      if (!fs.existsSync(paths.otree)) {
        sendStatus(mainWindow, STATUS_MESSAGES.OTREE_NOT_FOUND)
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'stopped')
        return
      }

      sendStatus(mainWindow, STATUS_MESSAGES.STARTING_VENV)

      // Find a free port (prefer 8000)
      currentPort = await getPort(DEFAULT_OTREE_PORT)
      sendStatus(mainWindow, `${STATUS_MESSAGES.USING_PORT} ${currentPort}`)

      const cmd = paths.otree
      const args = ['devserver', currentPort.toString()]

      // Prepare environment with venv in PATH
      const env = { ...process.env }
      const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
      const binDir = path.dirname(paths.python)

      // Prepend venv bin to PATH
      const currentPath = env[pathKey] || ''
      env[pathKey] = `${binDir}${path.delimiter}${currentPath}`

      // Force Python to be unbuffered so logs appear immediately
      env['PYTHONUNBUFFERED'] = '1'

      isDockerMode = false
      // Removed shell: true for security
      otreeProcess = spawn(cmd, args, { cwd: validatedPath, env })

      let portBusy = false

      // Helper to check for running status
      const checkRunning = (log: string): void => {
        if (
          log.includes(`http://localhost:${currentPort}`) ||
          log.includes(`http://127.0.0.1:${currentPort}`)
        ) {
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'running')
          // Send server URL to renderer for browser open button
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_SERVER_URL, `http://localhost:${currentPort}`)
        }
        if (log.includes(ERROR_CODES.ERRNO_10048) || log.includes('address already in use')) {
          portBusy = true
        }
      }

      if (otreeProcess.stdout) {
        otreeProcess.stdout.on('data', (data: Buffer) => {
          const log = data.toString()
          logToUIAndFile(mainWindow, log)

          // Inject system message when detecting Control+C instruction
          if (log.includes('To quit the server, press Control+C') || log.includes('press Control+C')) {
            logToUIAndFile(mainWindow, SYSTEM_MESSAGES.CONTROL_C_WARNING)
          }

          checkRunning(log)
        })
      }

      if (otreeProcess.stderr) {
        otreeProcess.stderr.on('data', (data: Buffer) => {
          const log = data.toString()
          logToUIAndFile(mainWindow, log)

          // Inject system message when detecting Control+C instruction
          if (log.includes('To quit the server, press Control+C') || log.includes('press Control+C')) {
            logToUIAndFile(mainWindow, SYSTEM_MESSAGES.CONTROL_C_WARNING)
          }

          checkRunning(log)
        })
      }

      otreeProcess.on('close', (code: number | null) => {
        if (portBusy) {
          sendStatus(
            mainWindow,
            `Port ${currentPort} ${STATUS_MESSAGES.PORT_BUSY}`
          )
          // We can optionally set status to running here if we are confident
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'running')
        } else {
          sendStatus(mainWindow, `${STATUS_MESSAGES.SERVER_EXITED} ${code}`)
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'stopped')
        }
        otreeProcess = null
      })
    } catch (error) {
      if (error instanceof Error) {
        sendStatus(mainWindow, `Error: ${error.message}`)
      } else {
        sendStatus(mainWindow, `An unknown error occurred`)
      }
    }
  })

  // 3. Handler: Stop oTree
  ipcMain.on(IPC_CHANNELS.OTREE_STOP, async () => {
    await killOtreeProcess(mainWindow)
    // Always send stopped status to ensure UI resets, even if process was already dead (e.g. zombie)
    mainWindow.webContents.send(IPC_CHANNELS.OTREE_STATUS, 'stopped')
  })

  // 4. Handler: Scan Python Versions
  ipcMain.handle(IPC_CHANNELS.OTREE_SCAN_PYTHON_VERSIONS, async () => {
    const versions: { version: string; path: string }[] = []

    // Always add generic 'python'
    versions.push({ version: 'System Default (python)', path: 'python' })

    if (process.platform === 'win32') {
      try {
        // Try 'py --list-paths' (Python Launcher)
        const { stdout } = await execAsync('py --list-paths')
        const lines = stdout.split('\n')
        lines.forEach((line) => {
          // Example:  -V:3.12 *        C:\Program Files\Python312\python.exe
          const match = line.match(/-V:(\d+\.\d+).*?\s+(.*)/)
          if (match) {
            versions.push({
              version: `Python ${match[1]} (${match[2].trim()})`,
              path: match[2].trim()
            })
          }
        })
      } catch {
        // py launcher not found, try 'where python'
        try {
          const { stdout } = await execAsync('where python')
          const paths = stdout.split('\r\n').filter((p) => p.trim())
          paths.forEach((p) => {
            versions.push({ version: `Python (${p})`, path: p })
          })
        } catch {
          // Ignore
        }
      }
    } else {
      // Unix/Mac
      try {
        const { stdout } = await execAsync('which -a python3 python')
        const paths = stdout.split('\n').filter((p) => p.trim())
        paths.forEach((p) => {
          versions.push({ version: `Python (${p})`, path: p })
        })
      } catch {
        // Ignore
      }
    }

    // Deduplicate by path
    const unique = new Map()
    versions.forEach((v) => {
      if (!unique.has(v.path)) {
        unique.set(v.path, v)
      }
    })

    return Array.from(unique.values())
  })

  // 5. Handler: Get Documents Path (for default suggestion)
  ipcMain.handle(IPC_CHANNELS.OTREE_GET_DOCUMENTS_PATH, () => {
    return path.join(app.getPath('documents'), 'oTreeProjects')
  })

  // 6. Handler: Get Virtual Environment Info
  ipcMain.handle(IPC_CHANNELS.OTREE_GET_VENV_INFO, (_event, projectPath: string) => {
    const paths = getVenvPaths(projectPath)
    const exists = fs.existsSync(paths.venvDir)

    return {
      venvDir: paths.venvDir,
      exists,
      venvBaseDir: path.join(app.getPath('userData'), 'venvs')
    }
  })

  // 7. Handler: Clean Virtual Environment
  ipcMain.handle(IPC_CHANNELS.OTREE_CLEAN_VENV, async (_event, projectPath: string) => {
    try {
      const paths = getVenvPaths(projectPath)

      if (fs.existsSync(paths.venvDir)) {
        await fs.remove(paths.venvDir)
        return { success: true, message: 'Virtual environment removed successfully.' }
      } else {
        return { success: true, message: 'No virtual environment found for this project.' }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  })

  // === Python Version Management Handlers ===
  const pythonManager = getPythonManager()

  // 8. Handler: Get available Python versions
  ipcMain.handle(IPC_CHANNELS.PYTHON_GET_VERSIONS, async () => {
    return pythonManager.getAllPythons()
  })

  // 9. Handler: Get downloadable Python versions
  ipcMain.handle(IPC_CHANNELS.PYTHON_GET_AVAILABLE_VERSIONS, async () => {
    return pythonManager.getAvailableVersions()
  })

  // 10. Handler: Scan system for Python installations
  ipcMain.handle(IPC_CHANNELS.PYTHON_SCAN_SYSTEM, async () => {
    try {
      return await pythonManager.scanSystemPythons()
    } catch (error) {
      console.error('Error scanning system Pythons:', error)
      return []
    }
  })

  // 11. Handler: Download a Python version
  ipcMain.on(IPC_CHANNELS.PYTHON_DOWNLOAD, async (_event: IpcMainEvent, version: string) => {
    try {
      mainWindow.webContents.send(IPC_CHANNELS.PYTHON_DOWNLOAD_STATUS, {
        version,
        status: 'downloading',
        progress: 0
      })

      const pythonPath = await pythonManager.downloadPython(version, (progress) => {
        mainWindow.webContents.send(IPC_CHANNELS.PYTHON_DOWNLOAD_PROGRESS, { version, progress })
      })

      mainWindow.webContents.send(IPC_CHANNELS.PYTHON_DOWNLOAD_STATUS, {
        version,
        status: 'complete',
        path: pythonPath
      })
    } catch (error) {
      mainWindow.webContents.send(IPC_CHANNELS.PYTHON_DOWNLOAD_STATUS, {
        version,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 12. Handler: Set project's Python version preference
  ipcMain.handle(
    IPC_CHANNELS.PYTHON_SET_PROJECT_VERSION,
    async (_event, projectHash: string, version: string) => {
      try {
        pythonManager.setProjectPython(projectHash, version)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )

  // 13. Handler: Get project's Python version preference
  ipcMain.handle(IPC_CHANNELS.PYTHON_GET_PROJECT_VERSION, async (_event, projectHash: string) => {
    return pythonManager.getProjectPython(projectHash)
  })

  // 14. Handler: Get Python path for a version
  ipcMain.handle(IPC_CHANNELS.PYTHON_GET_PATH, async (_event, version: string) => {
    return pythonManager.getPythonPath(version)
  })

  // 15. Handler: Delete a managed Python version
  ipcMain.handle(IPC_CHANNELS.PYTHON_DELETE, async (_event, version: string) => {
    try {
      await pythonManager.deletePython(version)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // 16. Handler: Check if a version is installed
  ipcMain.handle(IPC_CHANNELS.PYTHON_IS_INSTALLED, async (_event, version: string) => {
    return pythonManager.isVersionInstalled(version)
  })

  // 17. Handler: Repair a managed Python (reinstall virtualenv)
  ipcMain.handle(IPC_CHANNELS.PYTHON_REPAIR, async (_event, version: string) => {
    try {
      const pythonPath = pythonManager.getPythonPath(version)
      if (!pythonPath) {
        return { success: false, error: 'Python version not found' }
      }

      // Check if it's a managed Python
      if (!isManagedPython(pythonPath)) {
        return { success: false, error: 'Can only repair managed Python versions' }
      }

      const pythonDir = path.dirname(pythonPath)
      const pipExe = path.join(pythonDir, 'Scripts', 'pip.exe')

      // Prepare environment without proxy settings
      const pipEnv = { ...process.env }
      delete pipEnv.HTTP_PROXY
      delete pipEnv.HTTPS_PROXY
      delete pipEnv.http_proxy
      delete pipEnv.https_proxy
      delete pipEnv.ALL_PROXY
      delete pipEnv.all_proxy
      delete pipEnv.NO_PROXY
      delete pipEnv.no_proxy

      // Reinstall virtualenv
      await new Promise<void>((resolve, reject) => {
        // Removed shell: true for security
        const proc = spawn(pipExe, ['install', '--no-proxy', '--force-reinstall', 'virtualenv'], {
          cwd: pythonDir,
          env: pipEnv
        })

        let output = ''
        proc.stdout?.on('data', (data) => {
          output += data.toString()
        })
        proc.stderr?.on('data', (data) => {
          output += data.toString()
        })

        proc.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Failed to repair Python: ${output}`))
          }
        })
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // 18. Handler: Extract sample project to documents folder
  ipcMain.handle(IPC_CHANNELS.EXTRACT_SAMPLE_PROJECT, async () => {
    try {
      const docsPath = app.getPath('documents')
      const targetPath = path.join(docsPath, 'oTree-Sample-Project')

      // Check if project already exists
      if (await fs.pathExists(targetPath)) {
        return {
          success: false,
          path: targetPath,
          error: 'Sample project already exists at this location. Please delete it first or choose a different location.'
        }
      }

      // Determine resources path based on environment
      let resourcesPath: string
      if (app.isPackaged) {
        // Production: use process.resourcesPath
        resourcesPath = process.resourcesPath
      } else {
        // Development: go up from out/main/index.js to project root, then to resources
        // __dirname in dev is: /path/to/project/out/main
        resourcesPath = path.join(__dirname, '../../resources')
      }

      const sourcePath = path.join(resourcesPath, 'risk_preferences-main', 'risk_preferences-main')

      // Verify source exists
      if (!(await fs.pathExists(sourcePath))) {
        return {
          success: false,
          error: `Sample project not found in resources: ${sourcePath}. App packaged: ${app.isPackaged}, Resources path: ${resourcesPath}`
        }
      }

      // Copy the entire project directory
      await fs.copy(sourcePath, targetPath)

      return {
        success: true,
        path: targetPath,
        message: `Sample project extracted to: ${targetPath}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract sample project'
      }
    }
  })

  // Project Creation Handlers

  // 19. Handler: Create new oTree project
  ipcMain.handle(
    IPC_CHANNELS.OTREE_CREATE_PROJECT,
    async (_event, params: CreateProjectParams): Promise<CreateProjectResult> => {
      const { projectName, targetPath, pythonPath, includeSamples } = params

      try {
        // Validate inputs
        if (!projectName || !targetPath || !pythonPath) {
          return {
            success: false,
            error: 'Missing required parameters'
          }
        }

        // Construct full project path
        const projectPath = path.join(targetPath, projectName)

        // Check if project directory already exists
        if (await fs.pathExists(projectPath)) {
          return {
            success: false,
            error: `Project directory already exists: ${projectPath}`
          }
        }

        // Ensure target directory exists
        await fs.ensureDir(targetPath)

        // First, check if otree is installed in the Python environment
        // Get the directory containing the Python executable
        const pythonDir = path.dirname(pythonPath)
        const otreeCmd = process.platform === 'win32'
          ? path.join(pythonDir, 'Scripts', 'otree.exe')
          : path.join(pythonDir, 'otree')

        let otreeInstalled = false
        try {
          // Check if otree command exists
          if (await fs.pathExists(otreeCmd)) {
            await execAsync(`"${otreeCmd}" --version`)
            otreeInstalled = true
          }
        } catch (error) {
          console.log('oTree not installed, will install it first')
        }

        // If otree is not installed, install it first
        if (!otreeInstalled) {
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_PROJECT_CREATION_PROGRESS, {
            percent: 10,
            status: 'Installing oTree...',
            projectName
          })

          try {
            // Prepare environment without proxy settings
            const pipEnv = { ...process.env }
            delete pipEnv.HTTP_PROXY
            delete pipEnv.HTTPS_PROXY
            delete pipEnv.http_proxy
            delete pipEnv.https_proxy
            delete pipEnv.ALL_PROXY
            delete pipEnv.all_proxy
            delete pipEnv.NO_PROXY
            delete pipEnv.no_proxy

            // Create pip install command with --no-proxy flag
            const pipCmd = process.platform === 'win32'
              ? path.join(pythonDir, 'Scripts', 'pip.exe')
              : path.join(pythonDir, 'bin', 'pip')

            await new Promise<void>((resolve, reject) => {
              const installProcess = spawn(pipCmd, ['install', '--no-proxy', 'otree'], {
                cwd: pythonDir,
                env: pipEnv
              })

              let output = ''
              let errorOutput = ''

              installProcess.stdout?.on('data', (data) => {
                output += data.toString()
                console.log('[pip install otree]:', data.toString())
              })

              installProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString()
                console.error('[pip install otree error]:', data.toString())
              })

              installProcess.on('close', (code) => {
                if (code === 0) {
                  resolve()
                } else {
                  reject(new Error(`Failed to install oTree: ${errorOutput || output}`))
                }
              })

              installProcess.on('error', (err) => {
                reject(new Error(`Failed to run pip: ${err.message}`))
              })
            })

            // Verify installation
            if (!await fs.pathExists(otreeCmd)) {
              return {
                success: false,
                error: 'oTree was installed but the otree command was not found. Please try installing oTree manually.'
              }
            }
          } catch (error) {
            return {
              success: false,
              error: `Failed to install oTree: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }
        }

        // Send progress update
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_PROJECT_CREATION_PROGRESS, {
          percent: 30,
          status: 'Creating project...',
          projectName
        })

        // Construct the otree startproject command arguments
        const args = ['startproject', projectName]

        // Execute otree startproject
        const createProcess = spawn(otreeCmd, args, {
          cwd: targetPath,
          shell: false
        })

        let output = ''
        let errorOutput = ''

        // Handle stdin to automatically respond to prompts
        if (createProcess.stdin) {
          // Wait a bit for the prompt to appear, then send response
          setTimeout(() => {
            if (createProcess.stdin) {
              // Send 'y' for samples or 'n' for no samples
              createProcess.stdin.write(includeSamples ? 'y\n' : 'n\n')
              createProcess.stdin.end()
            }
          }, 1000)
        }

        createProcess.stdout?.on('data', (data) => {
          output += data.toString()
          console.log('otree startproject:', data.toString())
        })

        createProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString()
          console.error('otree startproject error:', data.toString())
        })

        // Wait for process to complete
        const exitCode = await new Promise<number>((resolve) => {
          createProcess.on('close', (code) => {
            resolve(code || 0)
          })
        })

        if (exitCode !== 0) {
          return {
            success: false,
            error: `Project creation failed with exit code ${exitCode}: ${errorOutput}`
          }
        }

        // Verify project was created
        const projectCreated = await fs.pathExists(projectPath)
        if (!projectCreated) {
          return {
            success: false,
            error: 'Project directory was not created'
          }
        }

        // Send final progress
        mainWindow.webContents.send(IPC_CHANNELS.OTREE_PROJECT_CREATION_PROGRESS, {
          percent: 100,
          status: 'Project created successfully!',
          projectName
        })

        return {
          success: true,
          projectPath,
          message: `Project "${projectName}" created successfully at ${projectPath}`
        }
      } catch (error) {
        console.error('Project creation error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      }
    }
  )

  // 20. Handler: Validate existing oTree project
  ipcMain.handle(
    IPC_CHANNELS.OTREE_VALIDATE_PROJECT,
    async (_event, projectPath: string): Promise<ValidateProjectResult> => {
      try {
        console.log('[Validate Project] Validating path:', projectPath)

        // Check if directory exists first
        const exists = await fs.pathExists(projectPath)
        console.log('[Validate Project] Path exists:', exists)
        if (!exists) {
          return {
            success: true,
            isValid: false,
            message: 'Directory does not exist'
          }
        }

        // Check if it's a directory
        const stat = await fs.stat(projectPath)
        console.log('[Validate Project] Is directory:', stat.isDirectory())
        if (!stat.isDirectory()) {
          return {
            success: true,
            isValid: false,
            message: 'Path is not a directory'
          }
        }

        // Check for essential oTree files
        const settingsPath = path.join(projectPath, 'settings.py')
        const requirementsPath = path.join(projectPath, 'requirements.txt')

        const hasSettings = await fs.pathExists(settingsPath)
        const hasRequirements = await fs.pathExists(requirementsPath)
        console.log('[Validate Project] Has settings.py:', hasSettings)
        console.log('[Validate Project] Has requirements.txt:', hasRequirements)

        // At minimum, should have settings.py
        if (!hasSettings) {
          return {
            success: true,
            isValid: false,
            message: 'Not a valid oTree project (missing settings.py)'
          }
        }

        // Optionally check if requirements.txt contains otree
        let hasOtreeInRequirements = false
        if (hasRequirements) {
          try {
            const requirementsContent = await fs.readFile(requirementsPath, 'utf-8')
            hasOtreeInRequirements = requirementsContent.toLowerCase().includes('otree')
          } catch (error) {
            console.warn('Could not read requirements.txt:', error)
          }
        }

        return {
          success: true,
          isValid: true,
          projectPath,
          message: hasOtreeInRequirements
            ? 'Valid oTree project'
            : 'Valid project structure (install requirements to confirm oTree installation)'
        }
      } catch (error) {
        console.error('[Validate Project] Error:', error)
        return {
          success: false,
          isValid: false,
          error: error instanceof Error ? error.message : 'Validation failed'
        }
      }
    }
  )

  // 21. Handler: Select .otreezip file
  ipcMain.handle(IPC_CHANNELS.OTREE_SELECT_OTREEZIP, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'oTree Project Files', extensions: ['otreezip'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    console.log('[Select .otreezip] Selected paths:', result.filePaths)
    return result.filePaths
  })

  // 22. Handler: Import .otreezip file
  ipcMain.handle(
    IPC_CHANNELS.OTREE_IMPORT_OTREEZIP,
    async (_event, params: ImportOtreezipParams): Promise<ImportOtreezipResult> => {
      const { otreezipPath, targetPath } = params

      try {
        // Validate inputs
        if (!otreezipPath || !targetPath) {
          return {
            success: false,
            error: 'Missing required parameters'
          }
        }

        // Helper function to send progress updates
        const sendProgress = (percent: number, status: string): void => {
          const progress: ImportProgress = { percent, status }
          mainWindow.webContents.send(IPC_CHANNELS.OTREE_IMPORT_PROGRESS, progress)
        }

        sendProgress(5, 'Validating .otreezip file...')

        // Validate zip file exists
        const zipExists = await fs.pathExists(otreezipPath)
        if (!zipExists) {
          return {
            success: false,
            error: 'Selected .otreezip file not found'
          }
        }

        // Ensure target directory exists
        await fs.ensureDir(targetPath)

        sendProgress(10, 'Extracting project files using oTree...')

        // Get extracted project name from filename (without extension)
        const fileBaseName = path.basename(otreezipPath, '.otreezip')
        const extractedProjectPath = path.join(targetPath, fileBaseName)

        // Check if destination already exists
        if (await fs.pathExists(extractedProjectPath)) {
          return {
            success: false,
            error: `A project with this name already exists at: ${extractedProjectPath}`
          }
        }

        try {
          // Use oTree's built-in unzip command
          // The command extracts to current directory, so we need to work in target directory
          await new Promise<void>((resolve, reject) => {
            const otreeCmd = process.platform === 'win32' ? 'otree.exe' : 'otree'
            const args = ['unzip', otreezipPath]

            const extractProcess = spawn(otreeCmd, args, {
              cwd: targetPath,
              shell: false
            })

            let output = ''
            let errorOutput = ''

            extractProcess.stdout?.on('data', (data) => {
              output += data.toString()
              console.log('[otree unzip]:', data.toString())
              sendProgress(50, 'Extracting files...')
            })

            extractProcess.stderr?.on('data', (data) => {
              errorOutput += data.toString()
              console.error('[otree unzip error]:', data.toString())
            })

            extractProcess.on('close', (code) => {
              if (code === 0) {
                sendProgress(70, 'Extraction complete')
                resolve()
              } else {
                reject(
                  new Error(
                    `oTree unzip failed with code ${code}. ${errorOutput || output || 'Make sure oTree is installed in your Python environment.'}`
                  )
                )
              }
            })

            extractProcess.on('error', (err) => {
              reject(
                new Error(
                  `Failed to run oTree command: ${err.message}. Make sure oTree is installed in your Python environment.`
                )
              )
            })
          })

          sendProgress(80, 'Validating extracted project...')

          // Verify the extracted project exists
          if (!(await fs.pathExists(extractedProjectPath))) {
            return {
              success: false,
              error: `Extraction succeeded but project not found at expected location: ${extractedProjectPath}`
            }
          }

          sendProgress(90, 'Validating oTree project structure...')

          // Validate it's a proper oTree project
          const validation = await validateOtreeProjectInternal(extractedProjectPath)
          if (!validation.isValid) {
            // If validation fails, clean up the extracted files
            await fs.remove(extractedProjectPath)
            return {
              success: false,
              error: validation.message || 'Extracted files are not a valid oTree project'
            }
          }

          // Check for runtime.txt and parse Python version
          let requiredPythonVersion: string | undefined
          try {
            const runtimePath = path.join(extractedProjectPath, 'runtime.txt')
            if (await fs.pathExists(runtimePath)) {
              const runtimeContent = await fs.readFile(runtimePath, 'utf-8')
              // Parse Python version from format like "python-3.7" or "3.7"
              const match = runtimeContent.trim().match(/python-?(\d+\.\d+)/i)
              if (match && match[1]) {
                requiredPythonVersion = match[1]
                console.log(`[Import] Found required Python version: ${requiredPythonVersion}`)
              }
            }
          } catch (error) {
            console.warn('Could not read runtime.txt:', error)
            // Continue without version info - not critical
          }

          sendProgress(100, 'Import complete!')

          return {
            success: true,
            projectPath: extractedProjectPath,
            message: `Project imported successfully to ${extractedProjectPath}`,
            requiredPythonVersion
          }
        } catch (extractError) {
          // Cleanup on error if directory was created
          if (await fs.pathExists(extractedProjectPath)) {
            await fs.remove(extractedProjectPath)
          }
          throw extractError
        }
      } catch (error) {
        console.error('[Import .otreezip] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to import .otreezip file'
        }
      }
    }
  )

}

// Helper: Internal validation function (doesn't send IPC events)
async function validateOtreeProjectInternal(projectPath: string): Promise<{ isValid: boolean; message?: string }> {
  try {
    const exists = await fs.pathExists(projectPath)
    if (!exists) {
      return { isValid: false, message: 'Directory does not exist' }
    }

    const stat = await fs.stat(projectPath)
    if (!stat.isDirectory()) {
      return { isValid: false, message: 'Path is not a directory' }
    }

    const settingsPath = path.join(projectPath, 'settings.py')
    const hasSettings = await fs.pathExists(settingsPath)

    if (!hasSettings) {
      return { isValid: false, message: 'Not a valid oTree project (missing settings.py)' }
    }

    return { isValid: true, message: 'Valid oTree project' }
  } catch (error) {
    return {
      isValid: false,
      message: error instanceof Error ? error.message : 'Validation failed'
    }
  }
}

// Helper: Send status updates
function sendStatus(window: BrowserWindow, msg: string): void {
  const message = `[SYSTEM] ${msg}\n`
  logToUIAndFile(window, message)
}

// Helper: Generate Docker Compose configuration with secure credentials
function generateComposeConfig(): DockerComposeConfig {
  // Generate a secure random password for the database
  const dbPassword = generateSecurePassword(24)

  return {
    version: '3',
    services: {
      db: {
        image: 'postgres:12',
        environment: {
          POSTGRES_DB: 'django_db',
          POSTGRES_USER: 'otree',
          POSTGRES_PASSWORD: dbPassword
        }
      },
      redis: {
        image: 'redis:6'
      },
      web: {
        // Ideally, use a version locked image in production
        image: 'python:3.9-slim',

        // Install requirements -> reset DB -> start server
        command:
          'sh -c "pip install -r requirements.txt && otree resetdb --noinput && otree runserver 0.0.0.0:8000"',

        // Mount the user directory
        volumes: [`.:/opt/otree`],
        working_dir: '/opt/otree',
        ports: ['8000:8000'],
        depends_on: ['db', 'redis'],
        environment: {
          DATABASE_URL: `postgres://otree:${dbPassword}@db/django_db`,
          REDIS_URL: 'redis://redis:6379',
          OTREE_AUTH_LEVEL: 'DEMO',
          OTREE_PRODUCTION: '0'
        }
      }
    }
  }
}

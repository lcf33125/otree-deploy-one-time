import { ipcMain, dialog, BrowserWindow, IpcMainEvent, app } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import yaml from 'yaml'
import { spawn, ChildProcess, exec } from 'child_process'
import net from 'net'
import util from 'util'

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
let currentPort = 8000

// Helper: Get a free port (try desiredPort first, then random)
const getPort = (desiredPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
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
        // Small delay to ensure OS releases the handle
        setTimeout(() => resolve(desiredPort), 50)
      })
    })
  })
}

// Helper: Initialize log file
const initLogFile = (projectPath: string, prefix: string): void => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logsDir = path.join(projectPath, 'launcher-logs')
    fs.ensureDirSync(logsDir)
    currentLogPath = path.join(logsDir, `${prefix}-${timestamp}.log`)
  } catch (e) {
    console.error('Failed to init log file', e)
  }
}

// Helper: Write to log file and send to UI
const logToUIAndFile = (window: BrowserWindow, msg: string): void => {
  if (!window.isDestroyed()) {
    window.webContents.send('otree:logs', msg)
  }
  if (currentLogPath) {
    fs.appendFile(currentLogPath, msg).catch((err) => console.error('Log write error:', err))
  }
}

// Exported function to kill the process (used by main/index.ts on app exit)
export const killOtreeProcess = (mainWindow?: BrowserWindow): void => {
  if (mainWindow) {
    sendStatus(mainWindow, 'Stopping server...')
  }

  if (otreeProcess) {
    if (isDockerMode && currentProjectPath) {
      try {
        const args = ['compose', '-f', 'docker-compose-launcher.yml', 'down']
        spawn('docker', args, { cwd: currentProjectPath, shell: true })
      } catch (e) {
        console.error('Failed to stop docker containers', e)
      }
    }

    // On Windows with shell: true, .kill() only kills the shell, not the child.
    // We use taskkill to kill the process tree.
    if (process.platform === 'win32') {
      try {
        // 1. Try to kill by PID if we have it
        if (otreeProcess.pid) {
          exec(`taskkill /pid ${otreeProcess.pid} /T /F`)
        }
        // 2. Also try to kill whatever is listening on the current port
        exec(`netstat -ano | findstr :${currentPort}`, (error, stdout) => {
          if (!error && stdout) {
            const lines = stdout.trim().split('\n')
            lines.forEach((line) => {
              const parts = line.trim().split(/\s+/)
              const pid = parts[parts.length - 1]
              if (pid && /^\d+$/.test(pid)) {
                exec(`taskkill /pid ${pid} /F`)
              }
            })
          }
        })
      } catch (e) {
        console.error('Failed to taskkill process', e)
      }
    } else {
      otreeProcess.kill()
    }

    otreeProcess = null
  }

  if (mainWindow) {
    sendStatus(mainWindow, 'Server stopped.')
  }
}

// Helper: Get venv paths
const getVenvPaths = (
  projectPath: string
): { python: string; pip: string; otree: string; venvDir: string } => {
  const isWin = process.platform === 'win32'
  const venvDir = path.join(projectPath, 'venv')
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
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.filePaths[0]
  })

  // 2. Handler: Start oTree (Docker)
  ipcMain.on('otree:start', async (_event: IpcMainEvent, projectPath: string) => {
    try {
      currentProjectPath = projectPath
      sendStatus(mainWindow, 'Initializing Docker environment...')

      // A. Generate docker-compose.yml in the user's project folder
      const composePath = path.join(projectPath, 'docker-compose-launcher.yml')

      // Generate the config object
      const composeConfig = generateComposeConfig()

      // Write the file
      await fs.writeFile(composePath, yaml.stringify(composeConfig))

      sendStatus(mainWindow, 'Config generated. Starting containers...')

      // B. Spawn the Docker Compose command
      // We use -f to point to our specific generated file
      const cmd = 'docker'
      const args = ['compose', '-f', 'docker-compose-launcher.yml', 'up', '--build']

      // Spawn the process
      isDockerMode = true
      otreeProcess = spawn(cmd, args, { cwd: projectPath, shell: true })

      // C. Stream Logs to UI
      if (otreeProcess.stdout) {
        otreeProcess.stdout.on('data', (data: Buffer) => {
          const log = data.toString()
          mainWindow.webContents.send('otree:logs', log)

          // Detect when server is ready
          if (log.includes('http://0.0.0.0:8000')) {
            mainWindow.webContents.send('otree:status', 'running')
          }
        })
      }

      if (otreeProcess.stderr) {
        otreeProcess.stderr.on('data', (data: Buffer) => {
          // Docker often sends normal info to stderr, so we treat it as log
          mainWindow.webContents.send('otree:logs', data.toString())
        })
      }

      otreeProcess.on('close', (code: number | null) => {
        sendStatus(mainWindow, `Process exited with code ${code}`)
        mainWindow.webContents.send('otree:status', 'stopped')
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
    'otree:install-requirements',
    async (_event: IpcMainEvent, projectPath: string, pythonCmd: string = 'python') => {
      try {
        initLogFile(projectPath, 'install')
        const paths = getVenvPaths(projectPath)

        // 1. Create venv if it doesn't exist
        if (!fs.existsSync(paths.venvDir)) {
          sendStatus(mainWindow, `Creating virtual environment (venv) using ${pythonCmd}...`)
          await new Promise<void>((resolve, reject) => {
            const venvProcess = spawn(pythonCmd, ['-m', 'venv', 'venv'], {
              cwd: projectPath,
              shell: true
            })
            venvProcess.on('close', (code) => {
              if (code === 0) resolve()
              else reject(new Error(`Failed to create venv, code ${code}`))
            })
          })
          sendStatus(mainWindow, 'Virtual environment created.')
        }

        // 2. Install requirements using venv pip
        sendStatus(mainWindow, 'Installing requirements in venv...')

        const cmd = paths.pip
        const args = ['install', '-r', 'requirements.txt']

        const installProcess = spawn(cmd, args, { cwd: projectPath, shell: true })

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
            sendStatus(mainWindow, 'Requirements installed successfully in venv.')
            mainWindow.webContents.send('otree:install-status', 'success')
          } else {
            sendStatus(mainWindow, `Installation failed with code ${code}`)
            mainWindow.webContents.send('otree:install-status', 'error')
          }
        })
      } catch (error) {
        if (error instanceof Error) {
          sendStatus(mainWindow, `Error: ${error.message}`)
        } else {
          sendStatus(mainWindow, `An unknown error occurred`)
        }
        mainWindow.webContents.send('otree:install-status', 'error')
      }
    }
  )

  // 2b-check. Handler: Check Requirements
  ipcMain.on('otree:check-requirements', async (_event: IpcMainEvent, projectPath: string) => {
    try {
      const paths = getVenvPaths(projectPath)

      // Check if venv python exists and can import otree
      if (!fs.existsSync(paths.python)) {
        mainWindow.webContents.send('otree:check-status', false)
        return
      }

      const cmd = paths.python
      const args = ['-c', 'import otree']

      const checkProcess = spawn(cmd, args, { cwd: projectPath, shell: true })

      checkProcess.on('close', (code: number | null) => {
        const isInstalled = code === 0
        mainWindow.webContents.send('otree:check-status', isInstalled)
      })
    } catch {
      mainWindow.webContents.send('otree:check-status', false)
    }
  })

  // 2c. Handler: Start oTree (Python)
  ipcMain.on('otree:start-python', async (_event: IpcMainEvent, projectPath: string) => {
    try {
      currentProjectPath = projectPath
      initLogFile(projectPath, 'server')
      const paths = getVenvPaths(projectPath)
      sendStatus(mainWindow, 'Starting oTree server from venv...')

      // Find a free port (prefer 8000)
      currentPort = await getPort(8000)
      sendStatus(mainWindow, `Using port ${currentPort}`)

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
      otreeProcess = spawn(cmd, args, { cwd: projectPath, shell: true, env })

      let portBusy = false

      // Helper to check for running status
      const checkRunning = (log: string): void => {
        if (
          log.includes(`http://localhost:${currentPort}`) ||
          log.includes(`http://127.0.0.1:${currentPort}`)
        ) {
          mainWindow.webContents.send('otree:status', 'running')
        }
        if (log.includes('Errno 10048') || log.includes('address already in use')) {
          portBusy = true
        }
      }

      if (otreeProcess.stdout) {
        otreeProcess.stdout.on('data', (data: Buffer) => {
          const log = data.toString()
          logToUIAndFile(mainWindow, log)
          checkRunning(log)
        })
      }

      if (otreeProcess.stderr) {
        otreeProcess.stderr.on('data', (data: Buffer) => {
          const log = data.toString()
          logToUIAndFile(mainWindow, log)
          checkRunning(log)
        })
      }

      otreeProcess.on('close', (code: number | null) => {
        if (portBusy) {
          sendStatus(
            mainWindow,
            `Port ${currentPort} is already in use. This process stopped, but the server is running (likely from a previous instance).`
          )
          // We can optionally set status to running here if we are confident
          mainWindow.webContents.send('otree:status', 'running')
        } else {
          sendStatus(mainWindow, `Server process exited with code ${code}`)
          mainWindow.webContents.send('otree:status', 'stopped')
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
  ipcMain.on('otree:stop', () => {
    killOtreeProcess(mainWindow)
    // Always send stopped status to ensure UI resets, even if process was already dead (e.g. zombie)
    mainWindow.webContents.send('otree:status', 'stopped')
  })

  // 4. Handler: Scan Python Versions
  ipcMain.handle('otree:scan-python-versions', async () => {
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
  ipcMain.handle('otree:get-documents-path', () => {
    return path.join(app.getPath('documents'), 'oTreeProjects')
  })
}

// Helper: Send status updates
function sendStatus(window: BrowserWindow, msg: string): void {
  const message = `[SYSTEM] ${msg}\n`
  logToUIAndFile(window, message)
}

// Helper: The Template
// We return a Record<string, any> (or a specific Interface if you want to be very strict)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateComposeConfig(): Record<string, any> {
  return {
    version: '3',
    services: {
      db: {
        image: 'postgres:12',
        environment: {
          POSTGRES_DB: 'django_db',
          POSTGRES_USER: 'otree',
          POSTGRES_PASSWORD: 'password'
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
          DATABASE_URL: 'postgres://otree:password@db/django_db',
          REDIS_URL: 'redis://redis:6379',
          OTREE_AUTH_LEVEL: 'DEMO',
          OTREE_PRODUCTION: '0'
        }
      }
    }
  }
}

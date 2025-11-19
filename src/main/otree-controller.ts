import { app, ipcMain, dialog, BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import yaml from 'yaml'
import { spawn, ChildProcess } from 'child_process'

// Fix PATH on macOS to ensure we can find the 'docker' command
if (process.platform === 'darwin') {
  try {
    const fixPath = require('fix-path')
    fixPath()
  } catch (error) {
    console.warn('Could not fix PATH on macOS:', error)
  }
}

let otreeProcess: ChildProcess | null = null

export const setupOtreeHandlers = (mainWindow: BrowserWindow): void => {

  // 1. Handler: Select Project Folder
  ipcMain.handle('dialog:openFolder', async (event: IpcMainInvokeEvent) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.filePaths[0]
  })

  // 2. Handler: Start oTree
  ipcMain.on('otree:start', async (event: IpcMainEvent, projectPath: string) => {
    try {
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

  // 3. Handler: Stop oTree
  ipcMain.on('otree:stop', (event: IpcMainEvent, projectPath: string) => {
    if (otreeProcess) {
        // Use docker compose down to clean up
        const args = ['compose', '-f', 'docker-compose-launcher.yml', 'down']
        spawn('docker', args, { cwd: projectPath, shell: true })
        
        otreeProcess.kill() 
        otreeProcess = null
        mainWindow.webContents.send('otree:status', 'stopped')
    }
  })
}

// Helper: Send status updates
function sendStatus(window: BrowserWindow, msg: string): void {
  // Ensure window wasn't closed before sending
  if (!window.isDestroyed()) {
    window.webContents.send('otree:logs', `[SYSTEM] ${msg}\n`)
  }
}

// Helper: The Template
// We return a Record<string, any> (or a specific Interface if you want to be very strict)
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
        command: 'sh -c "pip install -r requirements.txt && otree resetdb --noinput && otree runserver 0.0.0.0:8000"',
        
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

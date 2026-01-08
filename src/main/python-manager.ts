import { app } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import https from 'https'
import { Extract } from 'unzipper'
import { spawn } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(require('child_process').execFile)

interface ManagedPython {
  version: string
  path: string
  downloadDate: string
  source: string
}

interface PythonRegistry {
  managed: ManagedPython[]
  system: ManagedPython[]
  projectPreferences: Record<string, string> // projectHash -> version
}

interface PythonVersion {
  version: string
  url: string
}

// Default Python embeddable versions for Windows (amd64)
const DEFAULT_PYTHON_VERSIONS: PythonVersion[] = [
  {
    version: '3.7.9',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.7.9-embed-amd64.zip'
  },
  {
    version: '3.8.10',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.8.10-embed-amd64.zip'
  },
  {
    version: '3.9.13',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.9.13-embed-amd64.zip'
  },
  {
    version: '3.10.11',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.10.11-embed-amd64.zip'
  },
  {
    version: '3.11.9',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.11.9-embed-amd64.zip'
  },
  {
    version: '3.12.7',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.12.7-embed-amd64.zip'
  },
  {
    version: '3.13.0',
    url: 'https://xindamate-1308187607.cos.ap-guangzhou.myqcloud.com/python/python-3.13.0-embed-amd64.zip'
  }
]

export class PythonManager {
  private pythonsDir: string
  private registryPath: string
  private registry: PythonRegistry
  private urlConfigPath: string
  private pythonVersions: PythonVersion[]

  constructor() {
    this.pythonsDir = path.join(app.getPath('userData'), 'pythons')
    this.registryPath = path.join(app.getPath('userData'), 'python-versions.json')
    this.urlConfigPath = path.join(app.getPath('userData'), 'python-urls.json')
    this.registry = this.loadRegistry()
    this.pythonVersions = this.loadPythonUrls()
    fs.ensureDirSync(this.pythonsDir)
  }

  /**
   * Load Python download URLs from config file, falling back to defaults
   */
  private loadPythonUrls(): PythonVersion[] {
    if (fs.existsSync(this.urlConfigPath)) {
      try {
        const customUrls = fs.readJsonSync(this.urlConfigPath)
        console.log(`Loaded custom Python URLs from ${this.urlConfigPath}`)
        return customUrls
      } catch (error) {
        console.error('Error loading Python URL config, using defaults:', error)
      }
    } else {
      // Create default config file on first run
      this.savePythonUrls(DEFAULT_PYTHON_VERSIONS)
      console.log(`Created default Python URL config at ${this.urlConfigPath}`)
    }
    return DEFAULT_PYTHON_VERSIONS
  }

  /**
   * Save Python download URLs to config file
   */
  private savePythonUrls(versions: PythonVersion[]): void {
    try {
      fs.writeJsonSync(this.urlConfigPath, versions, { spaces: 2 })
    } catch (error) {
      console.error('Error saving Python URL config:', error)
    }
  }

  /**
   * Download and install a Python version
   */
  async downloadPython(version: string, onProgress: (percent: number) => void): Promise<string> {
    const versionData = this.pythonVersions.find((v) => v.version === version)
    if (!versionData) {
      throw new Error(`Unsupported version: ${version}`)
    }

    const installDir = path.join(this.pythonsDir, version)
    if (fs.existsSync(installDir)) {
      throw new Error(`Python ${version} is already installed`)
    }

    await fs.ensureDir(installDir)
    const zipPath = path.join(installDir, 'python.zip')

    try {
      // Download
      console.log(`Downloading Python ${version} from ${versionData.url}`)
      await this.downloadFile(versionData.url, zipPath, onProgress)

      // Extract
      console.log(`Extracting Python ${version}...`)
      await fs
        .createReadStream(zipPath)
        .pipe(Extract({ path: installDir }))
        .promise()

      // Configure pip for embeddable Python
      console.log(`Setting up pip for Python ${version}...`)
      await this.setupEmbeddablePython(installDir, version)

      // Update registry
      const pythonExe = path.join(installDir, 'python.exe')
      this.registry.managed.push({
        version,
        path: pythonExe,
        downloadDate: new Date().toISOString(),
        source: 'python.org'
      })
      this.saveRegistry()

      // Cleanup
      await fs.remove(zipPath)

      console.log(`Python ${version} installed successfully at ${pythonExe}`)
      return pythonExe
    } catch (error) {
      // Cleanup on failure
      await fs.remove(installDir).catch(() => {})
      throw error
    }
  }

  /**
   * Setup pip for embeddable Python
   */
  private async setupEmbeddablePython(installDir: string, version: string): Promise<void> {
    try {
      // 1. Uncomment "import site" in python{version}._pth file
      const majorMinor = version.split('.').slice(0, 2).join('')
      const pthFile = path.join(installDir, `python${majorMinor}._pth`)

      if (fs.existsSync(pthFile)) {
        let content = await fs.readFile(pthFile, 'utf-8')
        content = content.replace(/#import site/g, 'import site')
        content = content.replace(/#import/g, 'import')
        await fs.writeFile(pthFile, content)
        console.log(`Updated ${pthFile} to enable site packages`)
      }

      // 2. Download get-pip.py (use version-specific URL for older Python versions)
      const getPipPath = path.join(installDir, 'get-pip.py')
      console.log('Downloading get-pip.py...')

      // Determine the correct get-pip.py URL based on Python version
      const [major, minor] = version.split('.').map(Number)
      let getPipUrl = 'https://bootstrap.pypa.io/get-pip.py' // Default for Python 3.9+

      if (major === 3 && minor === 7) {
        getPipUrl = 'https://bootstrap.pypa.io/pip/3.7/get-pip.py'
      } else if (major === 3 && minor === 8) {
        getPipUrl = 'https://bootstrap.pypa.io/pip/3.8/get-pip.py'
      }

      await this.downloadFile(getPipUrl, getPipPath, () => {})

      // 3. Run get-pip.py to install pip
      const pythonExe = path.join(installDir, 'python.exe')
      console.log('Installing pip...')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(pythonExe, [getPipPath], {
          cwd: installDir,
          shell: true,
          env: {
            ...process.env,
            NO_PROXY: '*',
            HTTP_PROXY: '',
            HTTPS_PROXY: '',
            http_proxy: '',
            https_proxy: ''
          }
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
            console.log('pip installed successfully')
            resolve()
          } else {
            console.error('pip installation output:', output)
            reject(new Error(`pip installation failed with code ${code}`))
          }
        })
      })

      // 4. Install virtualenv (required for embeddable Python to create venvs)
      console.log('Installing virtualenv...')
      const pipExe = path.join(installDir, 'Scripts', 'pip.exe')
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(pipExe, ['install', 'virtualenv'], {
          cwd: installDir,
          shell: true,
          env: {
            ...process.env,
            NO_PROXY: '*',
            HTTP_PROXY: '',
            HTTPS_PROXY: '',
            http_proxy: '',
            https_proxy: ''
          }
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
            console.log('virtualenv installed successfully')
            resolve()
          } else {
            console.error('virtualenv installation output:', output)
            reject(new Error(`virtualenv installation failed with code ${code}`))
          }
        })
      })

      // Cleanup
      await fs.remove(getPipPath)
    } catch (error) {
      console.error('Error setting up embeddable Python:', error)
      throw error
    }
  }

  /**
   * Scan system for installed Python versions
   */
  async scanSystemPythons(): Promise<ManagedPython[]> {
    const systemPythons: ManagedPython[] = []
    const seenPaths = new Set<string>()

    try {
      // Method 1: Check common Windows installation paths
      const commonPaths = [
        'C:\\Python37',
        'C:\\Python38',
        'C:\\Python39',
        'C:\\Python310',
        'C:\\Python311',
        'C:\\Python312',
        'C:\\Python313'
      ]

      if (process.env.LOCALAPPDATA) {
        const localPythons = path.join(process.env.LOCALAPPDATA, 'Programs', 'Python')
        if (fs.existsSync(localPythons)) {
          const dirs = await fs.readdir(localPythons)
          dirs.forEach((dir) => {
            commonPaths.push(path.join(localPythons, dir))
          })
        }
      }

      if (process.env.ProgramFiles) {
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python37'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python38'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python39'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python310'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python311'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python312'))
        commonPaths.push(path.join(process.env.ProgramFiles, 'Python313'))
      }

      // Check each path
      for (const pythonDir of commonPaths) {
        const pythonExe = path.join(pythonDir, 'python.exe')
        if (fs.existsSync(pythonExe)) {
          const version = await this.getPythonVersion(pythonExe)
          if (version && !seenPaths.has(pythonExe)) {
            systemPythons.push({ version, path: pythonExe, downloadDate: '', source: 'system' })
            seenPaths.add(pythonExe)
          }
        }
      }

      // Method 2: Check PATH using 'where python'
      const pathPythons = await this.findPythonInPath()
      for (const pythonPath of pathPythons) {
        if (!seenPaths.has(pythonPath)) {
          const version = await this.getPythonVersion(pythonPath)
          if (version) {
            systemPythons.push({ version, path: pythonPath, downloadDate: '', source: 'system' })
            seenPaths.add(pythonPath)
          }
        }
      }

      // Update registry
      this.registry.system = systemPythons
      this.saveRegistry()

      console.log(`Found ${systemPythons.length} system Python installations`)
      return systemPythons
    } catch (error) {
      console.error('Error scanning for system Python:', error)
      return systemPythons
    }
  }

  /**
   * Get all available Python versions (managed + system)
   */
  getAllPythons(): { managed: ManagedPython[]; system: ManagedPython[] } {
    return {
      managed: this.registry.managed,
      system: this.registry.system
    }
  }

  /**
   * Get list of downloadable Python versions
   */
  getAvailableVersions(): string[] {
    return this.pythonVersions.map((v) => v.version)
  }

  /**
   * Check if a version is already installed (managed)
   */
  isVersionInstalled(version: string): boolean {
    return this.registry.managed.some((p) => p.version === version)
  }

  /**
   * Set project's preferred Python version
   */
  setProjectPython(projectHash: string, version: string): void {
    this.registry.projectPreferences[projectHash] = version
    this.saveRegistry()
  }

  /**
   * Get project's preferred Python version
   */
  getProjectPython(projectHash: string): string | null {
    return this.registry.projectPreferences[projectHash] || null
  }

  /**
   * Get Python path for a specific version
   */
  getPythonPath(version: string): string | null {
    const managed = this.registry.managed.find((p) => p.version === version)
    if (managed) return managed.path

    const system = this.registry.system.find((p) => p.version === version)
    if (system) return system.path

    return null
  }

  /**
   * Delete a managed Python version
   */
  async deletePython(version: string): Promise<void> {
    const python = this.registry.managed.find((p) => p.version === version)
    if (!python) {
      throw new Error(`Python ${version} is not a managed installation`)
    }

    const installDir = path.dirname(python.path)
    await fs.remove(installDir)

    // Update registry
    this.registry.managed = this.registry.managed.filter((p) => p.version !== version)
    this.saveRegistry()

    console.log(`Deleted Python ${version}`)
  }

  /**
   * Load registry from disk
   */
  private loadRegistry(): PythonRegistry {
    if (fs.existsSync(this.registryPath)) {
      try {
        return fs.readJsonSync(this.registryPath)
      } catch (error) {
        console.error('Error loading Python registry:', error)
      }
    }
    return { managed: [], system: [], projectPreferences: {} }
  }

  /**
   * Save registry to disk
   */
  private saveRegistry(): void {
    try {
      fs.writeJsonSync(this.registryPath, this.registry, { spaces: 2 })
    } catch (error) {
      console.error('Error saving Python registry:', error)
    }
  }

  /**
   * Download a file from URL with progress tracking
   */
  private async downloadFile(
    url: string,
    dest: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest)
      let isResolved = false

      https
        .get(url, (response) => {
          // Handle redirects
          if (
            response.statusCode === 301 ||
            response.statusCode === 302 ||
            response.statusCode === 307 ||
            response.statusCode === 308
          ) {
            const redirectUrl = response.headers.location
            if (redirectUrl) {
              file.close()
              this.downloadFile(redirectUrl, dest, onProgress).then(resolve).catch(reject)
              return
            }
          }

          if (response.statusCode !== 200) {
            file.close()
            fs.remove(dest).catch(() => {})
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10)
          let downloaded = 0

          response.on('data', (chunk) => {
            downloaded += chunk.length
            if (totalSize > 0) {
              const percent = (downloaded / totalSize) * 100
              onProgress(percent)
            }
          })

          response.pipe(file)

          file.on('finish', () => {
            if (!isResolved) {
              isResolved = true
              file.close()
              resolve()
            }
          })

          file.on('error', (err) => {
            if (!isResolved) {
              isResolved = true
              file.close()
              fs.remove(dest).catch(() => {})
              reject(err)
            }
          })
        })
        .on('error', (err) => {
          if (!isResolved) {
            isResolved = true
            file.close()
            fs.remove(dest).catch(() => {})
            reject(err)
          }
        })
    })
  }

  /**
   * Get Python version from executable
   */
  private async getPythonVersion(pythonPath: string): Promise<string | null> {
    try {
      const { stdout, stderr } = await execFile(pythonPath, ['--version'], { timeout: 5000 })
      const output = stdout + stderr
      const match = output.match(/Python (\d+\.\d+\.\d+)/)
      return match ? match[1] : null
    } catch (error) {
      return null
    }
  }

  /**
   * Find Python executables in PATH
   */
  private async findPythonInPath(): Promise<string[]> {
    try {
      const { exec } = require('child_process')
      return new Promise((resolve) => {
        exec('where python', (error: Error | null, stdout: string) => {
          if (error) {
            resolve([])
          } else {
            const paths = stdout
              .split('\n')
              .map((p) => p.trim())
              .filter(Boolean)
              .filter((p) => p.toLowerCase().endsWith('.exe'))
            resolve(paths)
          }
        })
      })
    } catch (error) {
      return []
    }
  }
}

// Export singleton instance
let pythonManagerInstance: PythonManager | null = null

export const getPythonManager = (): PythonManager => {
  if (!pythonManagerInstance) {
    pythonManagerInstance = new PythonManager()
  }
  return pythonManagerInstance
}

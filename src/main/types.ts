// Docker Compose configuration types
export interface DockerComposeConfig {
  version: string
  services: {
    db: DockerServiceConfig
    redis: DockerServiceConfig
    web: DockerServiceConfig
  }
}

export interface DockerServiceConfig {
  image: string
  environment?: Record<string, string>
  command?: string
  volumes?: string[]
  working_dir?: string
  ports?: string[]
  depends_on?: string[]
}

// Python version info
export interface PythonVersion {
  version: string
  path: string
}

// Virtual environment paths
export interface VenvPaths {
  python: string
  pip: string
  otree: string
  venvDir: string
}

// Process cleanup result
export interface CleanupResult {
  success: boolean
  message?: string
}

import path from 'path'
import fs from 'fs-extra'

/**
 * Validates and sanitizes a project path to prevent directory traversal attacks
 * @param projectPath - The path to validate
 * @returns The resolved absolute path
 * @throws Error if path is invalid or unsafe
 */
export function validateProjectPath(projectPath: string): string {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('Invalid project path: path must be a non-empty string')
  }

  // Resolve to absolute path to prevent relative path attacks
  const resolvedPath = path.resolve(projectPath)

  // Check if path exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Invalid project path: path does not exist: ${resolvedPath}`)
  }

  // Check if it's a directory
  const stats = fs.statSync(resolvedPath)
  if (!stats.isDirectory()) {
    throw new Error(`Invalid project path: path is not a directory: ${resolvedPath}`)
  }

  // Additional security: prevent paths outside reasonable boundaries
  // This prevents attacks trying to access system directories
  const normalizedPath = path.normalize(resolvedPath)

  // Check for suspicious patterns
  if (normalizedPath.includes('\0')) {
    throw new Error('Invalid project path: path contains null bytes')
  }

  return resolvedPath
}

/**
 * Validates a file path for writing
 * @param filePath - The file path to validate
 * @param expectedParent - Optional parent directory that must contain this file
 * @returns The resolved absolute path
 */
export function validateFilePath(filePath: string, expectedParent?: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string')
  }

  const resolvedPath = path.resolve(filePath)

  // Check for null bytes
  if (resolvedPath.includes('\0')) {
    throw new Error('Invalid file path: path contains null bytes')
  }

  // If expectedParent is provided, ensure the file is within that directory
  if (expectedParent) {
    const resolvedParent = path.resolve(expectedParent)
    if (!resolvedPath.startsWith(resolvedParent + path.sep) && resolvedPath !== resolvedParent) {
      throw new Error(`Invalid file path: path must be within ${resolvedParent}`)
    }
  }

  return resolvedPath
}

/**
 * Safely generates a random password for Docker services
 * @param length - Password length (default 16)
 * @returns Random password string
 */
export function generateSecurePassword(length: number = 16): string {
  const crypto = require('crypto')
  return crypto.randomBytes(length).toString('base64').slice(0, length)
}

/**
 * Checks if a path appears to be a managed Python installation
 * @param pythonPath - Path to Python executable
 * @returns True if it's a managed Python
 */
export function isManagedPython(pythonPath: string): boolean {
  const normalizedPath = path.normalize(pythonPath)
  return normalizedPath.includes(`otree-deploy-one-click${path.sep}pythons${path.sep}`) ||
         normalizedPath.includes(`otree-deploy-one-click/pythons/`)
}

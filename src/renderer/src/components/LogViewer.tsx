import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

interface LogViewerProps {
  logs: string[]
  autoCopy?: boolean
}

type LogFilter = 'all' | 'errors' | 'warnings'

const LogViewer: React.FC<LogViewerProps> = ({ logs, autoCopy = false }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [logFilter, setLogFilter] = useState<LogFilter>('all')

  // Track how many log entries we have processed
  const lastWrittenIndex = useRef(0)
  const lastFilteredLogs = useRef<string[]>([])

  // Keep autoCopy ref up to date for the event listener
  const autoCopyRef = useRef(autoCopy)
  useEffect(() => {
    autoCopyRef.current = autoCopy
  }, [autoCopy])

  // ANSI color codes
  const COLORS = {
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
  }

  // Detect log level and apply syntax highlighting
  const highlightLog = (log: string): string => {
    const lowerLog = log.toLowerCase()

    // Error patterns (red)
    if (
      lowerLog.includes('error') ||
      lowerLog.includes('exception') ||
      lowerLog.includes('failed') ||
      lowerLog.includes('failure') ||
      lowerLog.includes('traceback') ||
      lowerLog.includes('fatal')
    ) {
      return `${COLORS.RED}${log}${COLORS.RESET}`
    }

    // Warning patterns (yellow)
    if (
      lowerLog.includes('warning') ||
      lowerLog.includes('warn') ||
      lowerLog.includes('deprecated')
    ) {
      return `${COLORS.YELLOW}${log}${COLORS.RESET}`
    }

    // Success patterns (green)
    if (
      lowerLog.includes('success') ||
      lowerLog.includes('complete') ||
      lowerLog.includes('installed') ||
      lowerLog.includes('starting server') ||
      lowerLog.includes('http://') ||
      lowerLog.includes('https://')
    ) {
      return `${COLORS.GREEN}${log}${COLORS.RESET}`
    }

    // System messages (blue)
    if (lowerLog.includes('[system]')) {
      return `${COLORS.BLUE}${log}${COLORS.RESET}`
    }

    return log
  }

  // Detect if log matches the filter
  const matchesFilter = (log: string): boolean => {
    const lowerLog = log.toLowerCase()

    if (logFilter === 'all') return true

    if (logFilter === 'errors') {
      return (
        lowerLog.includes('error') ||
        lowerLog.includes('exception') ||
        lowerLog.includes('failed') ||
        lowerLog.includes('failure') ||
        lowerLog.includes('traceback') ||
        lowerLog.includes('fatal')
      )
    }

    if (logFilter === 'warnings') {
      return (
        lowerLog.includes('warning') ||
        lowerLog.includes('warn') ||
        lowerLog.includes('deprecated')
      )
    }

    return true
  }

  // Filter and highlight logs
  const filteredLogs = useMemo(() => {
    return logs.filter(matchesFilter).map(highlightLog)
  }, [logs, logFilter])

  // Export logs function
  const handleExportLogs = (): void => {
    const logText = logs.join('')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `otree-logs-${new Date().toISOString().replace(/:/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: false,
      convertEol: true, // Treats \n as \r\n
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      disableStdin: true, // Read-only
      theme: {
        background: '#000000',
        foreground: '#d1d5db', // Default gray color
        cursor: 'transparent',
        selectionBackground: 'rgba(255, 255, 255, 0.3)'
      }
    })

    const fitAddon = new FitAddon()
    // WebLinksAddon makes URLs clickable
    const webLinksAddon = new WebLinksAddon((_event: MouseEvent, uri: string) => {
      // Use Electron's shell.openExternal through IPC
      window.api.openUrl(uri)
    })

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle Selection for Auto-Copy
    term.onSelectionChange(() => {
      if (autoCopyRef.current && term.hasSelection()) {
        const selection = term.getSelection()
        navigator.clipboard
          .writeText(selection)
          .catch((err) => console.error('Auto-copy failed:', err))
      }
    })

    // Handle resize
    const handleResize = (): void => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  // Effect to write new logs to terminal
  useEffect(() => {
    if (!xtermRef.current) return

    // Handle Clear or filter change - rewrite all filtered logs
    if (
      logs.length < lastWrittenIndex.current ||
      JSON.stringify(filteredLogs) !== JSON.stringify(lastFilteredLogs.current)
    ) {
      xtermRef.current.clear()
      filteredLogs.forEach((chunk) => {
        xtermRef.current?.write(chunk)
      })
      lastWrittenIndex.current = logs.length
      lastFilteredLogs.current = filteredLogs
      return
    }

    // Only write the new entries
    const newLogs = filteredLogs.slice(lastFilteredLogs.current.length)
    if (newLogs.length > 0) {
      newLogs.forEach((chunk) => {
        xtermRef.current?.write(chunk)
      })
      lastWrittenIndex.current = logs.length
      lastFilteredLogs.current = filteredLogs
    }
  }, [logs, filteredLogs])

  // Re-fit whenever the component updates (e.g. parent container resizes)
  useEffect(() => {
    // Small delay to ensure DOM is settled
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit()
    }, 50)
    return () => clearTimeout(timer)
  })

  return (
    <div className="h-full w-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/30 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filter:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                logFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setLogFilter('errors')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                logFilter === 'errors'
                  ? 'bg-red-600 text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setLogFilter('warnings')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                logFilter === 'warnings'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              Warnings
            </button>
          </div>
        </div>
        <button
          onClick={handleExportLogs}
          disabled={logs.length === 0}
          className="px-3 py-1 text-xs rounded transition-colors bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          title="Export logs to file"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          Save Logs
        </button>
      </div>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden">
        <div
          className="h-full w-full overflow-hidden rounded-md border border-border bg-black"
          ref={terminalRef}
        />
      </div>
    </div>
  )
}

export default LogViewer

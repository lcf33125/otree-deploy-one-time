import React, { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

interface LogViewerProps {
  logs: string[]
  autoCopy?: boolean
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, autoCopy = false }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Track how many log entries we have processed
  const lastWrittenIndex = useRef(0)

  // Keep autoCopy ref up to date for the event listener
  const autoCopyRef = useRef(autoCopy)
  useEffect(() => {
    autoCopyRef.current = autoCopy
  }, [autoCopy])

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
        foreground: '#4ade80', // Tailwind green-400
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

    // Handle Clear
    if (logs.length < lastWrittenIndex.current) {
      xtermRef.current.clear()
      lastWrittenIndex.current = 0
    }

    // Only write the new entries
    const newLogs = logs.slice(lastWrittenIndex.current)
    if (newLogs.length > 0) {
      newLogs.forEach((chunk) => {
        xtermRef.current?.write(chunk)
      })
      lastWrittenIndex.current = logs.length
    }
  }, [logs])

  // Re-fit whenever the component updates (e.g. parent container resizes)
  useEffect(() => {
    // Small delay to ensure DOM is settled
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit()
    }, 50)
    return () => clearTimeout(timer)
  })

  return (
    <div
      className="h-full w-full overflow-hidden rounded-md border border-border bg-black"
      ref={terminalRef}
    />
  )
}

export default LogViewer

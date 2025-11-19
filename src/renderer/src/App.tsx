import React, { useState, useEffect, useRef } from 'react'

// 1. Define the shape of the API exposed from preload.js
interface IElectronAPI {
  selectFolder: () => Promise<string>
  startOtree: (path: string) => void
  stopOtree: (path: string) => void
  onLogs: (callback: (log: string) => void) => void
  onStatusChange: (callback: (status: string) => void) => void
  removeAllListeners: () => void
}

// 2. Extend the global Window interface to include our API
declare global {
  interface Window {
    api: IElectronAPI
  }
}

const App: React.FC = () => {
  // 3. Add Types to State
  const [projectPath, setProjectPath] = useState<string>('')
  
  // valid status strings
  const [status, setStatus] = useState<'stopped' | 'running'>('stopped')
  
  const [logs, setLogs] = useState<string[]>([])
  
  // 4. Type the Ref to HTMLDivElement
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Listen for Logs
    window.api.onLogs((newLog: string) => {
      setLogs((prev) => [...prev, newLog])
    })

    // Listen for Status Changes
    window.api.onStatusChange((newStatus: string) => {
      // Cast the string from backend to our union type
      setStatus(newStatus as 'stopped' | 'running')
    })

    return () => window.api.removeAllListeners()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleSelectFolder = async () => {
    const path = await window.api.selectFolder()
    if (path) setProjectPath(path)
  }

  const handleStart = () => {
    if (!projectPath) {
      alert('Please select a folder first')
      return
    }
    setLogs([]) // Clear logs
    window.api.startOtree(projectPath)
  }

  const handleStop = () => {
    window.api.stopOtree(projectPath)
  }

  const openBrowser = () => {
    window.open('http://localhost:8000', '_blank')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white p-6 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-blue-400">oTree Launcher</h1>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${status === 'running' ? 'bg-green-600' : 'bg-red-600'}`}>
          {status.toUpperCase()}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 rounded-lg flex gap-4 items-center mb-4">
        <button 
          onClick={handleSelectFolder}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
        >
          {projectPath ? 'Change Folder' : 'Select oTree Folder'}
        </button>
        <span className="text-gray-400 text-sm truncate flex-1">
            {projectPath || 'No folder selected'}
        </span>

        {status === 'stopped' ? (
          <button 
            onClick={handleStart} 
            disabled={!projectPath}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold disabled:opacity-50 transition-colors"
          >
            Start Server
          </button>
        ) : (
          <div className="flex gap-2">
             <button 
              onClick={openBrowser} 
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded font-bold transition-colors"
            >
              Open Browser
            </button>
            <button 
              onClick={handleStop} 
              className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Logs Console */}
      <div className="flex-1 bg-black rounded-lg p-4 overflow-y-auto font-mono text-xs text-green-400 border border-gray-700 shadow-inner whitespace-pre-wrap">
        {logs.length === 0 && <span className="text-gray-600">Ready to launch...</span>}
        {logs.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default App

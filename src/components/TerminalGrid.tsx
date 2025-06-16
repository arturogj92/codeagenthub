import React, { useState, useRef, useEffect } from 'react'
import { Session } from '../types'

interface TerminalGridProps {
  sessions: Session[]
}

interface TerminalWindowProps {
  session: Session
  claudeSessionId?: string
  index: number
  onClose: () => void
  onResize: (width: number, height: number) => void
}

function TerminalWindow({ session, claudeSessionId, index, onClose, onResize }: TerminalWindowProps) {
  const [input, setInput] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  
  // Get real output from Claude tmux session (temporarily disabled for testing)
  const [output, setOutput] = useState('')
  const isLoading = false
  // const { data: output = '', isLoading } = useClaudeSessionOutput(claudeSessionId, 100)

  // Simulate some output for testing
  useEffect(() => {
    const interval = setInterval(() => {
      setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] Terminal ${session.id} - Mock output...\n`)
    }, 3000)
    return () => clearInterval(interval)
  }, [session.id])

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (input.trim()) {
        // Simulate command execution
        setOutput(prev => prev + `$ ${input}\n`)
        console.log('Command executed:', input)
      }
      setInput('')
    }
  }

  const handleCloseTerminal = () => {
    onClose()
  }

  return (
    <div className={`bg-black/90 border border-color rounded-lg flex flex-col overflow-hidden transition-all duration-200 ${
      isMinimized ? 'h-8' : 'h-[500px]'
    }`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <button 
              onClick={handleCloseTerminal}
              className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
            />
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-3 h-3 bg-yellow-500 rounded-full hover:bg-yellow-600 transition-colors"
            />
            <button className="w-3 h-3 bg-green-500 rounded-full hover:bg-green-600 transition-colors" />
          </div>
          <span className="text-xs text-gray-300 font-mono">
            Claude Session #{session.id} - {session.agent}
            {claudeSessionId && <span className="text-blue-400"> (tmux: {claudeSessionId.slice(-8)})</span>}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <div className={`w-2 h-2 rounded-full ${
            isLoading ? 'bg-yellow-400 animate-pulse' : 
            claudeSessionId ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}></div>
          <span>{
            isLoading ? 'Loading...' :
            claudeSessionId ? 'Connected' : 'Disconnected'
          }</span>
        </div>
      </div>

      {/* Terminal Content */}
      {!isMinimized && (
        <>
          <div 
            ref={terminalRef}
            className="flex-1 p-3 overflow-y-auto bg-black text-green-400 font-mono text-sm leading-relaxed min-h-0"
            style={{ maxHeight: '400px' }}
          >
            <div className="mb-2 text-gray-500">
              === CodeAgent Hub Terminal ===<br/>
              Project: {session.project}<br/>
              Branch: {session.branch}<br/>
              Worktree: {session.worktree}<br/>
              {claudeSessionId && <span>Claude Session: {claudeSessionId}<br/></span>}
              {'─'.repeat(50)}<br/>
            </div>
            {isLoading && claudeSessionId && (
              <div className="text-yellow-400 mb-2">
                🔄 Loading Claude session output...
              </div>
            )}
            {!claudeSessionId && (
              <div className="text-red-400 mb-2">
                ❌ No Claude session active. Create a job to start one.
              </div>
            )}
            <pre className="whitespace-pre-wrap">{output}</pre>
          </div>

          {/* Terminal Input */}
          <div className="flex items-center px-3 py-2 bg-gray-900 border-t border-gray-700">
            <span className="text-green-400 font-mono text-sm mr-2">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none"
              placeholder="Enter command for terminal..."
            />
          </div>
        </>
      )}
    </div>
  )
}

export function TerminalGrid({ sessions }: TerminalGridProps) {
  const [terminals, setTerminals] = useState<Session[]>([])
  const [gridLayout, setGridLayout] = useState({ cols: 2, rows: 2 })
  
  // Get active Claude sessions from tmux (temporarily disabled)
  // const { data: claudeSessions = [] } = useActiveClaudeSessions()
  const claudeSessions: any[] = []

  // Auto-create terminals for active sessions + mock sessions for testing
  useEffect(() => {
    let activeSessions = sessions.slice(0, 6) // Max 6 terminals
    
    // Add mock sessions if no real sessions exist
    if (activeSessions.length === 0) {
      activeSessions = [
        {
          id: 1,
          project: '/tmp/mock-project',
          agent: 'claude_sub',
          branch: 'main',
          worktree: '/tmp/worktree-1',
          started_at: new Date().toISOString()
        },
        {
          id: 2,
          project: '/tmp/another-project',
          agent: 'claude_sub', 
          branch: 'feature/test',
          worktree: '/tmp/worktree-2',
          started_at: new Date().toISOString()
        }
      ]
    }
    
    setTerminals(activeSessions)
  }, [sessions])

  // Map session to Claude session ID
  const getClaudeSessionId = (session: Session) => {
    // Find matching Claude session for this session
    const claudeSession = claudeSessions.find(cs => cs.jobId === session.id)
    return claudeSession?.sessionId
  }

  const addNewTerminal = () => {
    if (terminals.length < 6) {
      // Create a mock session for new terminal
      const newSession: Session = {
        id: Date.now(),
        project: '/tmp/new-session',
        agent: 'claude_sub',
        branch: 'main',
        worktree: '/tmp/worktree',
        started_at: new Date().toISOString()
      }
      setTerminals(prev => [...prev, newSession])
    }
  }

  const removeTerminal = (sessionId: number) => {
    setTerminals(prev => prev.filter(s => s.id !== sessionId))
  }

  const updateGridLayout = (cols: number, rows: number) => {
    setGridLayout({ cols, rows })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Grid Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-white">Terminal Grid</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted">Layout:</span>
            <button
              onClick={() => updateGridLayout(1, 1)}
              className={`px-2 py-1 text-xs rounded ${gridLayout.cols === 1 ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              1×1
            </button>
            <button
              onClick={() => updateGridLayout(2, 2)}
              className={`px-2 py-1 text-xs rounded ${gridLayout.cols === 2 ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              2×2
            </button>
            <button
              onClick={() => updateGridLayout(3, 2)}
              className={`px-2 py-1 text-xs rounded ${gridLayout.cols === 3 ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              3×2
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted">{terminals.length}/6 terminales</span>
          <button
            onClick={addNewTerminal}
            disabled={terminals.length >= 6}
            className="px-3 py-1 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            + Terminal
          </button>
        </div>
      </div>

      {/* Terminal Grid */}
      <div 
        className={`flex-1 grid gap-4`}
        style={{
          gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`
        }}
      >
        {Array.from({ length: gridLayout.cols * gridLayout.rows }).map((_, index) => {
          const session = terminals[index]
          
          if (!session) {
            // Empty slot
            return (
              <div
                key={`empty-${index}`}
                className="border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center"
              >
                <div className="text-center text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-sm">Terminal vacío</p>
                  <button
                    onClick={addNewTerminal}
                    className="mt-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                  >
                    Crear sesión
                  </button>
                </div>
              </div>
            )
          }

          return (
            <TerminalWindow
              key={session.id}
              session={session}
              claudeSessionId={getClaudeSessionId(session)}
              index={index}
              onClose={() => removeTerminal(session.id)}
              onResize={(width, height) => {
                // Handle resize logic
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
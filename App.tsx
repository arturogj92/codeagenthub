import React, { useState, useEffect } from 'react'
import './src/types/electron.d.ts'

// Tipos básicos
interface Terminal {
  id: number
  name: string
  mode: 'plan' | 'interactive' | 'auto'
  claudeMode?: 'default' | 'auto-accept' | 'plan' // Modo actual de Claude (interno)
  status: 'inactive' | 'idle' | 'running' | 'waiting_confirmation'
  currentFile?: string
  output: string[]
  projectPath?: string
  sessionId?: string
}

interface Task {
  id: number
  title: string
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR'
  terminal: number
  prompt: string
  createdAt: Date
}

interface NewSessionForm {
  projectPath: string
  mode: 'plan' | 'interactive' | 'auto'
  initialPrompt: string
}

// Persistencia simple con localStorage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

const loadFromStorage = (key: string, defaultValue: any) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch (error) {
    console.error('Error loading from localStorage:', error)
    return defaultValue
  }
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [terminals, setTerminals] = useState<Terminal[]>(() => 
    loadFromStorage('terminals', [
      { id: 1, name: 'Terminal 1', mode: 'interactive', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
      { id: 2, name: 'Terminal 2', mode: 'plan', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
      { id: 3, name: 'Terminal 3', mode: 'auto', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
      { id: 4, name: 'Terminal 4', mode: 'interactive', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] }
    ])
  )
  
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage('tasks', []))
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState<number | null>(null)
  const [newSessionForm, setNewSessionForm] = useState<NewSessionForm>({
    projectPath: '',
    mode: 'interactive',
    initialPrompt: ''
  })

  // Estado para controlar polling
  const [pollingIntervals, setPollingIntervals] = useState<Map<number, NodeJS.Timeout>>(new Map())

  // Guardar en localStorage cuando cambien los datos
  useEffect(() => {
    saveToStorage('terminals', terminals)
  }, [terminals])

  useEffect(() => {
    saveToStorage('tasks', tasks)
  }, [tasks])

  // Función para iniciar polling de output
  const startOutputPolling = (terminalId: number, sessionId: string) => {
    // Limpiar polling anterior si existe
    const existingInterval = pollingIntervals.get(terminalId)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    let lastOutput = ''
    
    const interval = setInterval(async () => {
      try {
        const output = await window.electronAPI.tmuxGetOutput(sessionId, 50) // Más líneas
        if (output && output !== lastOutput) {
          lastOutput = output
          const outputLines = output.split('\n').filter(line => line.trim())
          
          // Solo actualizar si hay contenido nuevo
          if (outputLines.length > 0) {
            setTerminals(prev => prev.map(t => 
              t.id === terminalId 
                ? { 
                    ...t, 
                    output: outputLines.slice(-30) // Mostrar más líneas (30)
                  }
                : t
            ))
          }
        }
      } catch (error) {
        console.error('Error polling tmux output:', error)
      }
    }, 250) // Poll cada 250ms - casi tiempo real

    setPollingIntervals(prev => new Map(prev.set(terminalId, interval)))

    // Limpiar después de 10 minutos
    setTimeout(() => {
      clearInterval(interval)
      setPollingIntervals(prev => {
        const newMap = new Map(prev)
        newMap.delete(terminalId)
        return newMap
      })
    }, 600000) // 10 minutos
  }

  // Limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      pollingIntervals.forEach(interval => clearInterval(interval))
    }
  }, [])

  // Event listeners para tmux
  useEffect(() => {
    if (!window.electronAPI) return

    const handleTmuxConfirmation = (event: any, data: any) => {
      console.log('Tmux confirmation required:', data)
      
      const terminal = terminals.find(t => t.sessionId === data.sessionId)
      if (terminal && terminal.status !== 'waiting_confirmation') { // Solo si no está ya esperando
        setTerminals(prev => prev.map(t => 
          t.sessionId === data.sessionId 
            ? { ...t, status: 'waiting_confirmation' as const, output: [...t.output, '🤔 Claude requiere confirmación... (click para aprobar)'] }
            : t
        ))
      }
    }

    const handleTmuxSessionEnded = (event: any, data: any) => {
      console.log('Tmux session ended:', data)
      const terminal = terminals.find(t => t.sessionId === data.sessionId)
      if (terminal) {
        handleStopSession(terminal.id)
      }
    }

    const handleTmuxSessionError = (event: any, data: any) => {
      console.log('Tmux session error:', data)
      setTerminals(prev => prev.map(t => 
        t.sessionId === data.sessionId 
          ? { ...t, status: 'idle' as const, output: [...t.output, `❌ Error en sesión: ${data.error}`] }
          : t
      ))
    }

    // Registrar listeners
    const unsubscribeConfirmation = window.electronAPI.onTmuxConfirmationRequired(handleTmuxConfirmation)
    const unsubscribeSessionEnded = window.electronAPI.onTmuxSessionEnded(handleTmuxSessionEnded)
    const unsubscribeSessionError = window.electronAPI.onTmuxSessionError(handleTmuxSessionError)

    return () => {
      unsubscribeConfirmation()
      unsubscribeSessionEnded()
      unsubscribeSessionError()
    }
  }, [terminals])

  // Función para cambiar modo de Claude
  const handleCycleClaudeMode = async (terminalId: number) => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal || !terminal.sessionId) return

    try {
      await window.electronAPI.tmuxCycleModes(terminal.sessionId)
      
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, output: [...t.output, `🔄 Cambiando modo de Claude...`] }
          : t
      ))

      // Esperar un poco y luego obtener el output para detectar el modo real
      setTimeout(async () => {
        try {
          const output = await window.electronAPI.tmuxGetOutput(terminal.sessionId, 10)
          let detectedMode = 'default'
          
          if (output.includes('auto-accept edits on')) {
            detectedMode = 'auto-accept'
          } else if (output.includes('plan mode on')) {
            detectedMode = 'plan'
          }
          
          setTerminals(prev => prev.map(t => 
            t.id === terminalId 
              ? { ...t, claudeMode: detectedMode as any }
              : t
          ))
        } catch (error) {
          console.error('Error detecting Claude mode:', error)
        }
      }, 500)
      
    } catch (error) {
      console.error('Error cycling Claude modes:', error)
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, output: [...t.output, `❌ Error cambiando modo: ${error.message}`] }
          : t
      ))
    }
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'plan': return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
      case 'interactive': return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
      case 'auto': return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
      default: return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="9 17v1H5v-1m0 0V9a4 4 0 018 0v8a4 4 0 01-8 0z" />
        </svg>
      )
    }
  }

  const getClaudeModeInfo = (claudeMode: string) => {
    switch (claudeMode) {
      case 'default': return { name: 'Interactivo', icon: '🤔', color: 'text-blue-400' }
      case 'auto-accept': return { name: 'Auto-aceptar', icon: '⚡', color: 'text-green-400' }
      case 'plan': return { name: 'Planificación', icon: '📋', color: 'text-purple-400' }
      default: return { name: 'Interactivo', icon: '🤔', color: 'text-blue-400' }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-secondary'
      case 'waiting_confirmation': return 'bg-accent'
      case 'idle': return 'bg-primary'
      case 'inactive': return 'bg-muted'
      default: return 'bg-muted'
    }
  }

  const handleCreateSession = (terminalId: number) => {
    const terminal = terminals.find(t => t.id === terminalId)
    setSelectedTerminal(terminalId)
    
    // Pre-rellenar con el último proyecto y modo si existe
    if (terminal?.projectPath) {
      setNewSessionForm(prev => ({ 
        ...prev, 
        projectPath: terminal.projectPath,
        mode: terminal.mode || 'interactive'
      }))
    }
    
    setShowNewSessionModal(true)
  }

  const handleSubmitNewSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTerminal || !newSessionForm.projectPath.trim()) return

    try {
      console.log('Creating tmux session...', { 
        terminal: selectedTerminal, 
        projectPath: newSessionForm.projectPath,
        mode: newSessionForm.mode 
      })

      // Crear sesión tmux real
      const sessionId = `terminal-${selectedTerminal}-${Date.now()}`
      
      const tmuxSessionId = await window.electronAPI.tmuxCreateSession({
        sessionId,
        workingDirectory: newSessionForm.projectPath
      })

      console.log('Tmux session created:', tmuxSessionId)
      
      setTerminals(prev => prev.map(terminal => 
        terminal.id === selectedTerminal 
          ? {
              ...terminal,
              status: 'idle' as const,
              projectPath: newSessionForm.projectPath,
              sessionId: sessionId, // Usar el sessionId original, no el tmuxSessionId
              mode: newSessionForm.mode,
              claudeMode: 'default', // Inicializar modo de Claude
              output: [
                `✅ Sesión tmux creada: ${tmuxSessionId}`,
                `📁 Proyecto: ${newSessionForm.projectPath}`,
                `🔧 Modo: ${newSessionForm.mode}`,
                `🚀 Iniciando Claude...`
              ]
            }
          : terminal
      ))

      // Iniciar polling inmediatamente para ver el output de Claude
      setTimeout(() => {
        startOutputPolling(selectedTerminal, sessionId)
      }, 500) // Iniciar polling casi inmediatamente

      if (newSessionForm.initialPrompt.trim()) {
        const newTask: Task = {
          id: Date.now(),
          title: newSessionForm.initialPrompt.slice(0, 50) + (newSessionForm.initialPrompt.length > 50 ? '...' : ''),
          status: 'QUEUED',
          terminal: selectedTerminal,
          prompt: newSessionForm.initialPrompt,
          createdAt: new Date()
        }
        setTasks(prev => [...prev, newTask])
      }

      setNewSessionForm({ projectPath: '', mode: 'interactive', initialPrompt: '' })
      setShowNewSessionModal(false)
      setSelectedTerminal(null)

    } catch (error) {
      console.error('Error creating session:', error)
      alert('Error al crear la sesión')
    }
  }

  const handleSendPrompt = async (terminalId: number, prompt: string) => {
    if (!prompt.trim()) return

    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal || terminal.status === 'inactive' || !terminal.sessionId) return

    const newTask: Task = {
      id: Date.now(),
      title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
      status: 'QUEUED',
      terminal: terminalId,
      prompt,
      createdAt: new Date()
    }
    setTasks(prev => [...prev, newTask])

    try {
      // Enviar comando real a tmux
      await window.electronAPI.tmuxSendCommand(terminal.sessionId, prompt)
      
      setTasks(prev => prev.map(task => 
        task.id === newTask.id ? { ...task, status: 'RUNNING' as const } : task
      ))
      
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, status: 'running' as const, output: [...t.output, `> ${prompt}`, '🚀 Comando enviado a Claude...'] }
          : t
      ))

      // Iniciar polling para obtener output
      startOutputPolling(terminalId, terminal.sessionId)
      
    } catch (error) {
      console.error('Error sending command to tmux:', error)
      setTasks(prev => prev.map(task => 
        task.id === newTask.id ? { ...task, status: 'ERROR' as const } : task
      ))
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, status: 'idle' as const, output: [...t.output, `❌ Error: ${error.message}`] }
          : t
      ))
    }
  }

  const handleStopSession = async (terminalId: number) => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal || !terminal.sessionId) return

    // Guardar el projectPath antes de limpiar
    const lastProjectPath = terminal.projectPath
    const lastMode = terminal.mode

    try {
      // Terminar sesión tmux real
      await window.electronAPI.tmuxTerminateSession(terminal.sessionId)
      
      // Limpiar polling
      const interval = pollingIntervals.get(terminalId)
      if (interval) {
        clearInterval(interval)
        setPollingIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(terminalId)
          return newMap
        })
      }

      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? {
              ...t,
              status: 'inactive' as const,
              projectPath: lastProjectPath, // Mantener el último proyecto
              sessionId: undefined,
              mode: lastMode, // Mantener el último modo
              output: [`Terminal inactivo. Último proyecto: ${lastProjectPath || 'ninguno'}`]
            }
          : t
      ))

      setTasks(prev => prev.map(task => 
        task.terminal === terminalId && (task.status === 'QUEUED' || task.status === 'RUNNING')
          ? { ...task, status: 'ERROR' as const }
          : task
      ))

      console.log(`✅ Sesión tmux terminada para terminal ${terminalId}`)
      
    } catch (error) {
      console.error('Error stopping tmux session:', error)
      alert(`Error al detener la sesión: ${error.message}`)
    }
  }

  const selectProjectDirectory = async () => {
    try {
      if (window.electronAPI?.openDirectoryDialog) {
        const selectedPath = await window.electronAPI.openDirectoryDialog()
        if (selectedPath) {
          setNewSessionForm(prev => ({ ...prev, projectPath: selectedPath }))
          return
        }
      }
      
      try {
        // @ts-ignore
        const { ipcRenderer } = require('electron')
        if (ipcRenderer) {
          const selectedPath = await ipcRenderer.invoke('open-directory-dialog')
          if (selectedPath) {
            setNewSessionForm(prev => ({ ...prev, projectPath: selectedPath }))
            return
          }
        }
      } catch (requireError) {
        // Silently fail and try fallback
      }
      
      const path = prompt('Ingresa la ruta del proyecto (ej: /Users/tu-usuario/mi-proyecto):')
      if (path) {
        setNewSessionForm(prev => ({ ...prev, projectPath: path }))
      }
      
    } catch (error) {
      console.error('Error selecting directory:', error)
      alert('Error al abrir el explorador de archivos: ' + error.message)
    }
  }

  // Componente para input de terminal
  const TerminalInput = ({ terminal, onSendPrompt, disabled }: { 
    terminal: Terminal
    onSendPrompt: (prompt: string) => void
    disabled: boolean
  }) => {
    const [prompt, setPrompt] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (prompt.trim() && !disabled) {
        onSendPrompt(prompt)
        setPrompt('')
      }
    }

    return (
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <span className="text-secondary">$</span>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={disabled ? "Terminal inactivo" : "Escribe tu prompt aquí..."}
          disabled={disabled}
          className="flex-1 bg-transparent text-white placeholder-muted outline-none disabled:text-muted input-dark border-0"
        />
        <button 
          type="submit"
          disabled={disabled || !prompt.trim()}
          className="px-3 py-1 bg-gradient-to-r from-primary to-secondary rounded text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-white font-medium"
        >
          Enviar
        </button>
      </form>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white" style={{ 
      background: 'radial-gradient(circle at 50% 50%, rgba(88, 28, 135, 0.45) 0%, rgba(17, 24, 39, 0) 80%), #030008'
    }}>
      {/* Main Container with beautiful backdrop */}
      <div className="relative min-h-screen">
        
        {/* Main App Layout */}
        <div className="flex h-screen">
          {/* Sidebar with gradient border */}
          <div 
            className={`transition-all duration-300 ${
              sidebarCollapsed ? 'w-16' : 'w-80'
            } flex-shrink-0 h-full rounded-lg border border-purple-500/30`}
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(127, 90, 240, 0.15) 0%, rgba(17, 24, 39, 0.8) 70%), rgba(22, 22, 29, 0.9)',
              backdropFilter: 'blur(12px)'
            }}
          >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-color/30 flex items-center justify-between">
                {!sidebarCollapsed && (
                  <h2 className="text-lg font-bold text-white">
                    Control Panel
                  </h2>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 rounded-lg hover:opacity-90 transition-all duration-200 shadow-lg bg-purple-600/80 hover:bg-purple-600/90"
                >
                  <svg className={`w-4 h-4 text-white transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              
              {!sidebarCollapsed && (
                <div className="p-4 space-y-6">
                  {/* Active Sessions */}
                  <div>
                    <h3 className="font-semibold mb-3 text-white flex items-center">
                      <div className="w-2 h-2 bg-secondary rounded-full animate-pulse mr-2"></div>
                      Sesiones Activas ({terminals.filter(t => t.status !== 'inactive').length})
                    </h3>
                    <div className="space-y-2">
                      {terminals.filter(terminal => terminal.status !== 'inactive').length > 0 ? (
                        terminals
                          .filter(terminal => terminal.status !== 'inactive')
                          .map(terminal => (
                            <div key={terminal.id} className="gradient-border">
                              <div className="gradient-border-content p-3 bg-card/60 backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white font-medium">{terminal.name}</span>
                                  <span className={`w-2 h-2 rounded-full ${getStatusColor(terminal.status)}`}></span>
                                </div>
                                <div className="text-xs text-muted space-y-1">
                                  <div className="flex items-center">
                                    <span className="mr-2 text-primary">{getModeIcon(terminal.mode)}</span>
                                    <span>{terminal.mode}</span>
                                  </div>
                                  {terminal.projectPath && (
                                    <div className="truncate text-primary flex items-center">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                      {terminal.projectPath.split('/').pop()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-center text-muted text-sm py-6 bg-card/30 rounded-lg border border-color/20">
                          <div className="mb-2 flex justify-center">
                            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </div>
                          <div>No hay sesiones activas.</div>
                          <div className="text-xs mt-1">Crea una nueva sesión para comenzar.</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div>
                    <h3 className="font-semibold mb-3 text-white">Controles</h3>
                    <div className="space-y-2">
                      <button 
                        onClick={() => setShowNewSessionModal(true)}
                        className="w-full p-3 bg-gradient-to-r from-secondary to-primary rounded-lg hover:opacity-90 transition-all duration-200 shadow-lg text-white font-medium flex items-center justify-center"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva Sesión
                      </button>
                      <button className="w-full p-3 bg-gradient-to-r from-accent to-secondary rounded-lg hover:opacity-90 transition-all duration-200 shadow-lg text-white font-medium flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9z" />
                        </svg>
                        Ver Métricas
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header with beautiful gradient */}
            <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-color/30 flex items-center justify-between px-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 opacity-50"></div>
              <div className="relative z-10 flex items-center space-x-4">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  CodeAgent Hub
                </h1>
                <div className="flex items-center space-x-2 text-sm text-muted">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <span>{tasks.filter(t => t.status === 'RUNNING').length} tareas ejecutándose</span>
                </div>
              </div>
              <div className="relative z-10 flex items-center space-x-4">
                <div className="text-sm text-muted">
                  Total: {tasks.length} tareas
                </div>
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
              </div>
            </header>

            {/* Terminals Grid - Beautiful design */}
            <div className="flex-1 p-6 min-h-0">
              <div className="grid grid-cols-2 gap-6 h-full" style={{ height: '600px' }}>
                {terminals.map(terminal => (
                  <div key={terminal.id} className="gradient-border h-full">
                    <div className="gradient-border-content bg-card/80 backdrop-blur-xl rounded-lg overflow-hidden flex flex-col h-full">
                      {/* Terminal Header */}
                      <div className="bg-card/60 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-color/30">
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-accent rounded-full"></div>
                            <div className="w-3 h-3 bg-secondary rounded-full"></div>
                          </div>
                          <span className="text-sm font-medium text-white">{terminal.name}</span>
                          <div className="px-2 py-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded text-xs border border-primary/30 flex items-center">
                            <span className="text-primary mr-1">{getModeIcon(terminal.mode)}</span>
                            {terminal.mode}
                          </div>
                          {terminal.sessionId && terminal.status !== 'inactive' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleCycleClaudeMode(terminal.id)
                              }}
                              className="text-xs bg-gradient-to-r from-secondary to-accent px-3 py-1 rounded-lg hover:opacity-90 transition-all duration-200 text-white font-medium flex items-center"
                              title="Cambiar modo de Claude (Shift+Tab)"
                            >
                              <span className="mr-1">
                                {getClaudeModeInfo(terminal.claudeMode || 'default').icon}
                              </span>
                              Claude: {getClaudeModeInfo(terminal.claudeMode || 'default').name}
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {terminal.currentFile && (
                            <span className="text-xs text-primary px-2 py-1 bg-primary/10 rounded border border-primary/30 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              {terminal.currentFile}
                            </span>
                          )}
                          {terminal.status === 'inactive' ? (
                            <button
                              onClick={() => handleCreateSession(terminal.id)}
                              className="text-xs bg-gradient-to-r from-secondary to-primary px-3 py-1 rounded-lg hover:opacity-90 transition-all duration-200 text-white font-medium flex items-center"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Iniciar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStopSession(terminal.id)}
                              className="text-xs bg-gradient-to-r from-red-500 to-red-600 px-3 py-1 rounded-lg hover:opacity-90 transition-all duration-200 text-white font-medium flex items-center"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h6v4H9z" />
                              </svg>
                              Parar
                            </button>
                          )}
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(terminal.status)}`}></div>
                        </div>
                      </div>

                      {/* Terminal Output */}
                      <div className="flex-1 p-4 font-mono text-sm text-secondary overflow-y-auto bg-black/20 min-h-0" style={{ height: '400px', maxHeight: '400px' }}>
                        {terminal.output.map((line, index) => (
                          <div key={index} className="mb-1">{line}</div>
                        ))}
                        <div className="w-2 h-4 bg-secondary animate-pulse inline-block"></div>
                      </div>

                      {/* Terminal Input */}
                      <div className="bg-card/60 backdrop-blur-sm p-3 border-t border-color/30">
                        <TerminalInput 
                          terminal={terminal}
                          onSendPrompt={(prompt) => handleSendPrompt(terminal.id, prompt)}
                          disabled={terminal.status === 'inactive'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compact Kanban - Beautiful design */}
            <div className="h-64 bg-card/80 backdrop-blur-xl border-t border-color/30 p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10"></div>
              <div className="relative z-10 h-full flex flex-col">
                <h3 className="font-semibold mb-3 text-white flex items-center">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse mr-2"></div>
                  Estado de Tareas
                </h3>
                <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
                  {[
                    { 
                      status: 'QUEUED', 
                      label: 'En Cola', 
                      color: 'from-muted to-muted', 
                      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    },
                    { 
                      status: 'RUNNING', 
                      label: 'Ejecutando', 
                      color: 'from-secondary to-primary', 
                      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    },
                    { 
                      status: 'DONE', 
                      label: 'Completado', 
                      color: 'from-secondary to-accent', 
                      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    },
                    { 
                      status: 'ERROR', 
                      label: 'Error', 
                      color: 'from-red-500 to-red-600', 
                      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    }
                  ].map(({ status, label, color, icon }) => (
                    <div key={status} className="gradient-border h-full">
                      <div className="gradient-border-content bg-card/60 backdrop-blur-sm rounded-lg p-3 h-full flex flex-col">
                        <h4 className={`text-sm font-medium mb-2 flex items-center bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                          <span className="mr-2">{icon}</span>
                          {label}
                        </h4>
                        <div className="flex-1 space-y-2 overflow-y-auto min-h-0 max-h-40 scrollbar-thin scrollbar-thumb-primary/50 scrollbar-track-transparent">
                          {tasks.filter(task => task.status === status).map(task => (
                            <div key={task.id} className="p-2 bg-card/40 rounded border border-color/20 backdrop-blur-sm">
                              <div className="truncate text-xs text-white font-medium">{task.title}</div>
                              <div className="text-xs text-muted mt-1 flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                                Terminal {task.terminal}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Beautiful Modal for new session */}
        {showNewSessionModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xl flex items-center justify-center z-50">
            <div className="gradient-border w-full max-w-md mx-4">
              <div className="gradient-border-content bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {selectedTerminal ? `Nueva Sesión - Terminal ${selectedTerminal}` : 'Nueva Sesión'}
                </h3>
                
                <form onSubmit={handleSubmitNewSession} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Ruta del Proyecto
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newSessionForm.projectPath}
                        onChange={(e) => setNewSessionForm(prev => ({ ...prev, projectPath: e.target.value }))}
                        className="flex-1 input-dark rounded-lg px-3 py-2"
                        placeholder="/ruta/al/proyecto"
                        required
                      />
                      <button
                        type="button"
                        onClick={selectProjectDirectory}
                        className="px-3 py-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 rounded-lg text-sm text-white transition-all duration-200 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Modo de Operación
                    </label>
                    <select
                      value={newSessionForm.mode}
                      onChange={(e) => setNewSessionForm(prev => ({ ...prev, mode: e.target.value as 'plan' | 'interactive' | 'auto' }))}
                      className="w-full select-dark rounded-lg px-3 py-2"
                    >
                      <option value="interactive">Interactive - Pide confirmación para cada cambio</option>
                      <option value="plan">Plan - Genera plan y pide aprobación</option>
                      <option value="auto">Auto - Ejecuta automáticamente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Prompt Inicial (Opcional)
                    </label>
                    <textarea
                      value={newSessionForm.initialPrompt}
                      onChange={(e) => setNewSessionForm(prev => ({ ...prev, initialPrompt: e.target.value }))}
                      className="w-full input-dark rounded-lg px-3 py-3 resize-none"
                      rows={3}
                      placeholder="Describe la tarea que quieres que Claude ejecute..."
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-2">
                    <button
                      type="submit"
                      disabled={!newSessionForm.projectPath.trim()}
                      className="flex-1 bg-gradient-to-r from-secondary to-primary hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.333 4z" />
                      </svg>
                      Crear Sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewSessionModal(false)
                        setSelectedTerminal(null)
                        setNewSessionForm({ projectPath: '', mode: 'interactive', initialPrompt: '' })
                      }}
                      className="px-4 py-2 border border-color rounded-lg text-muted hover:bg-card/50 transition-all duration-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
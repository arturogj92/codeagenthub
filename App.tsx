import React, { useState, useEffect } from 'react'

// Tipos básicos
interface Terminal {
  id: number
  name: string
  mode: 'plan' | 'interactive' | 'auto'
  status: 'inactive' | 'idle' | 'running' | 'waiting_confirmation'
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

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [tasksCollapsed, setTasksCollapsed] = useState(false)
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: 1, name: 'Terminal 1', mode: 'interactive', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
    { id: 2, name: 'Terminal 2', mode: 'plan', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
    { id: 3, name: 'Terminal 3', mode: 'auto', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] },
    { id: 4, name: 'Terminal 4', mode: 'interactive', status: 'inactive', output: ['Terminal inactivo. Crear sesión para comenzar.'] }
  ])
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState<number | null>(null)
  const [newSessionForm, setNewSessionForm] = useState<NewSessionForm>({
    projectPath: '',
    mode: 'interactive',
    initialPrompt: ''
  })

  // Función para crear sesión
  const handleCreateSession = (terminalId: number) => {
    setSelectedTerminal(terminalId)
    setShowNewSessionModal(true)
  }

  // Función para enviar prompt a tmux
  const handleSendPrompt = async (terminalId: number, prompt: string) => {
    if (!prompt.trim()) return

    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal || terminal.status === 'inactive' || !terminal.sessionId) return

    try {
      // Enviar comando real a tmux
      await window.electronAPI.tmuxSendCommand(terminal.sessionId, prompt)
      
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, status: 'running' as const, output: [...t.output, `> ${prompt}`, '🚀 Enviando a Claude...'] }
          : t
      ))
    } catch (error) {
      console.error('Error sending command to tmux:', error)
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, status: 'idle' as const, output: [...t.output, `❌ Error: ${error.message}`] }
          : t
      ))
    }
  }

  // Función para crear nueva sesión tmux
  const handleSubmitNewSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTerminal || !newSessionForm.projectPath.trim()) return

    try {
      const sessionId = `terminal-${selectedTerminal}-${Date.now()}`
      
      const tmuxSessionId = await window.electronAPI.tmuxCreateSession({
        sessionId,
        workingDirectory: newSessionForm.projectPath
      })

      setTerminals(prev => prev.map(terminal => 
        terminal.id === selectedTerminal 
          ? {
              ...terminal,
              status: 'idle' as const,
              projectPath: newSessionForm.projectPath,
              sessionId: sessionId,
              mode: newSessionForm.mode,
              output: [
                `✅ Sesión tmux creada: ${tmuxSessionId}`,
                `📁 Proyecto: ${newSessionForm.projectPath}`,
                `🔧 Modo: ${newSessionForm.mode}`,
                `🚀 Claude iniciado`
              ]
            }
          : terminal
      ))

      setNewSessionForm({ projectPath: '', mode: 'interactive', initialPrompt: '' })
      setShowNewSessionModal(false)
      setSelectedTerminal(null)

    } catch (error) {
      console.error('Error creating session:', error)
      alert('Error al crear la sesión: ' + error.message)
    }
  }

  // Función para seleccionar directorio
  const selectProjectDirectory = async () => {
    try {
      if (window.electronAPI?.openDirectoryDialog) {
        const selectedPath = await window.electronAPI.openDirectoryDialog()
        if (selectedPath) {
          setNewSessionForm(prev => ({ ...prev, projectPath: selectedPath }))
        }
      }
    } catch (error) {
      console.error('Error selecting directory:', error)
      const path = prompt('Ingresa la ruta del proyecto:')
      if (path) {
        setNewSessionForm(prev => ({ ...prev, projectPath: path }))
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white" style={{ 
      background: 'radial-gradient(circle at 50% 50%, rgba(88, 28, 135, 0.45) 0%, rgba(17, 24, 39, 0) 80%), #030008'
    }}>
      {/* Main App Layout */}
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-80'
        } flex-shrink-0 h-full bg-purple-900/30 border-r border-purple-500/30`}>
          <div className="p-4 border-b border-purple-500/30 flex items-center justify-between">
            {!sidebarCollapsed && (
              <h2 className="text-lg font-bold text-white">Control Panel</h2>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-purple-600/50 transition-all duration-200 text-white"
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          {!sidebarCollapsed && (
            <div className="p-4">
              <h3 className="font-semibold mb-3 text-white">
                Sesiones Activas ({terminals.filter(t => t.status !== 'inactive').length})
              </h3>
              <div className="text-center text-gray-400 py-4">
                No hay sesiones activas
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 bg-gray-800/50 border-b border-purple-500/30 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-purple-400">CodeAgent Hub</h1>
              <div className="text-sm text-gray-400">
                {tasks.filter(t => t.status === 'RUNNING').length} tareas ejecutándose
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">Total: {tasks.length} tareas</div>
              <button
                onClick={() => setTasksCollapsed(!tasksCollapsed)}
                className="p-2 rounded-lg hover:bg-purple-600/20 transition-all duration-200 text-purple-400"
                title="Mostrar/ocultar panel de tareas"
              >
                <svg className={`w-5 h-5 transition-transform duration-300 ${tasksCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </header>

          {/* Main Content with Terminals and Tasks */}
          <div className="flex-1 flex overflow-hidden">
            {/* Terminals Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6">
                {terminals.map(terminal => (
                  <div key={terminal.id} className="bg-gray-800/50 rounded-lg border border-purple-500/30 overflow-hidden flex flex-col" style={{ height: '500px' }}>
                    {/* Terminal Header */}
                    <div className="bg-gray-700/50 px-4 py-3 border-b border-purple-500/30 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium text-white">{terminal.name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          terminal.mode === 'plan' ? 'bg-purple-500/20 text-purple-300' :
                          terminal.mode === 'interactive' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {terminal.mode}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {terminal.status === 'inactive' ? (
                          <button 
                            onClick={() => handleCreateSession(terminal.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
                          >
                            Iniciar
                          </button>
                        ) : (
                          <button className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white">
                            Parar
                          </button>
                        )}
                        <div className={`w-2 h-2 rounded-full ${
                          terminal.status === 'running' ? 'bg-green-400' :
                          terminal.status === 'waiting_confirmation' ? 'bg-yellow-400' :
                          terminal.status === 'idle' ? 'bg-blue-400' : 'bg-gray-400'
                        }`}></div>
                      </div>
                    </div>

                    {/* Terminal Output */}
                    <div className="flex-1 p-4 bg-black/40 font-mono text-sm text-green-400 overflow-y-auto">
                      {terminal.output.map((line, index) => (
                        <div key={index} className="mb-1">{line}</div>
                      ))}
                      <div className="w-2 h-4 bg-green-400 animate-pulse inline-block"></div>
                    </div>

                    {/* Terminal Input */}
                    <div className="bg-gray-700/50 p-3 border-t border-purple-500/30">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder={terminal.status === 'inactive' ? 'Terminal inactivo. Crear sesión primero.' : 'Escribe un comando o prompt...'}
                          disabled={terminal.status === 'inactive'}
                          className="flex-1 px-3 py-2 bg-gray-800 border border-purple-500/30 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && terminal.sessionId) {
                              const input = e.target as HTMLInputElement
                              if (input.value.trim()) {
                                handleSendPrompt(terminal.id, input.value.trim())
                                input.value = ''
                              }
                            }
                          }}
                        />
                        <button
                          disabled={terminal.status === 'inactive'}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-all duration-200 disabled:opacity-50 text-sm"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement
                            if (input.value.trim() && terminal.sessionId) {
                              handleSendPrompt(terminal.id, input.value.trim())
                              input.value = ''
                            }
                          }}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Panel - Right Sidebar */}
            {!tasksCollapsed && (
              <div className="w-96 bg-gray-800/50 border-l border-purple-500/30 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    Tareas ({tasks.length})
                  </h2>
                  <button
                    onClick={() => setTasksCollapsed(true)}
                    className="p-1 rounded hover:bg-purple-600/20 transition-all duration-200 text-purple-400"
                    title="Ocultar panel de tareas"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="text-center text-gray-400 py-8">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>No hay tareas pendientes</p>
                  <p className="text-xs mt-1">Las tareas aparecerán aquí cuando envíes prompts a Claude</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para nueva sesión */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md mx-4 border border-purple-500/30">
            <h3 className="text-lg font-semibold text-white mb-4">
              Nueva Sesión - Terminal {selectedTerminal}
            </h3>
            
            <form onSubmit={handleSubmitNewSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Ruta del Proyecto
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSessionForm.projectPath}
                    onChange={(e) => setNewSessionForm(prev => ({ ...prev, projectPath: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-purple-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="/ruta/al/proyecto"
                    required
                  />
                  <button
                    type="button"
                    onClick={selectProjectDirectory}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white"
                  >
                    📁
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Modo de Operación
                </label>
                <select
                  value={newSessionForm.mode}
                  onChange={(e) => setNewSessionForm(prev => ({ ...prev, mode: e.target.value as 'plan' | 'interactive' | 'auto' }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-purple-500/30 rounded text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="interactive">Interactive - Pide confirmación</option>
                  <option value="plan">Plan - Genera plan primero</option>
                  <option value="auto">Auto - Ejecuta automáticamente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Prompt Inicial (Opcional)
                </label>
                <textarea
                  value={newSessionForm.initialPrompt}
                  onChange={(e) => setNewSessionForm(prev => ({ ...prev, initialPrompt: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-purple-500/30 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  rows={3}
                  placeholder="Describe la tarea que quieres que Claude ejecute..."
                />
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={!newSessionForm.projectPath.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear Sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSessionModal(false)
                    setSelectedTerminal(null)
                    setNewSessionForm({ projectPath: '', mode: 'interactive', initialPrompt: '' })
                  }}
                  className="px-4 py-2 border border-gray-600 rounded text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
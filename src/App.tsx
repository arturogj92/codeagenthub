import React, { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TerminalGrid } from './components/TerminalGrid'
import { CompactKanban } from './components/CompactKanban'
import { NotificationCenter } from './components/NotificationCenter'
import { SessionDetail } from './components/SessionDetail'
import { ClaudeConfirmationModal } from './components/ClaudeConfirmationModal'
import { useSessions, useJobs, useCreateJob } from './hooks/useElectron'
import { useAllPendingConfirmations } from './hooks/useClaudeInteractive'
import { Session, Job } from './types'

export default function App() {
  const { data: sessions = [] } = useSessions()
  const { data: jobs = [] } = useJobs()
  const createJob = useCreateJob()
  // Temporarily disabled to avoid errors
  // const { data: pendingConfirmations = [] } = useAllPendingConfirmations()
  const pendingConfirmations: any[] = []
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showNewJobForm, setShowNewJobForm] = useState<number | null>(null)
  const [newJobPrompt, setNewJobPrompt] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  // Auto-show confirmation modal when confirmations are pending
  React.useEffect(() => {
    if (pendingConfirmations.length > 0) {
      setShowConfirmationModal(true)
    }
  }, [pendingConfirmations.length])

  const handleCreateJobForSession = (sessionId: number) => {
    setShowNewJobForm(sessionId)
    setNewJobPrompt('')
  }

  const handleSubmitJob = (e: React.FormEvent) => {
    e.preventDefault()
    if (!showNewJobForm || !newJobPrompt.trim()) return

    createJob.mutate({
      session_id: showNewJobForm,
      prompt: newJobPrompt,
    }, {
      onSuccess: () => {
        setShowNewJobForm(null)
        setNewJobPrompt('')
      },
      onError: (error) => {
        console.error('Error creating job:', error)
        alert('Error creating job: ' + error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-grid-background flex">
      {/* Sidebar plegable */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-80'} flex-shrink-0`}>
        <Sidebar 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sessions={sessions}
          jobs={jobs}
          onCreateJob={handleCreateJobForSession}
          onSelectSession={setSelectedSession}
          selectedSession={selectedSession}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with notifications */}
        <header className="h-16 bg-card/80 backdrop-blur-xl border-b border-color flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-white">CodeAgent Hub</h1>
            <div className="flex items-center space-x-2 text-sm text-muted">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <span>{jobs.filter((j: Job) => j.status === 'RUNNING').length} en ejecución</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Confirmation Alert */}
            {pendingConfirmations.length > 0 && (
              <button
                onClick={() => setShowConfirmationModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 hover:bg-yellow-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium">
                  {pendingConfirmations.length} Confirmation{pendingConfirmations.length !== 1 ? 's' : ''}
                </span>
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              </button>
            )}
            <NotificationCenter jobs={jobs} />
          </div>
        </header>
        
        {/* Main grid area - Terminales */}
        <div className="flex-1 p-4 min-h-0 bg-background/50">
          <TerminalGrid sessions={sessions} />
        </div>
        
        {/* Bottom area - Kanban compacto */}
        <div className="h-64 border-t border-color bg-card/50 backdrop-blur-sm">
          <CompactKanban jobs={jobs} />
        </div>
      </div>

      {/* Modal para crear job */}
      {showNewJobForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-color rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Nueva Tarea</h3>
            
            <form onSubmit={handleSubmitJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Prompt de la tarea
                </label>
                <textarea
                  value={newJobPrompt}
                  onChange={(e) => setNewJobPrompt(e.target.value)}
                  className="w-full px-3 py-3 bg-background border border-color rounded-lg text-white placeholder-muted focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  rows={4}
                  placeholder="Describe la tarea que quieres ejecutar..."
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={createJob.isPending || !newJobPrompt.trim()}
                  className="flex-1 bg-gradient-to-r from-primary to-secondary text-white px-4 py-3 rounded-lg font-medium hover:from-primary/90 hover:to-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  {createJob.isPending ? 'Creando...' : 'Crear Tarea'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewJobForm(null)}
                  className="px-4 py-3 border border-color rounded-lg text-muted hover:bg-border/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de detalle de sesión */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          jobs={jobs}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {/* Claude Confirmation Modal */}
      <ClaudeConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
      />
    </div>
  )
}
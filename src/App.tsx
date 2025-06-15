import React, { useState } from 'react'
import { KanbanBoard } from './components/KanbanBoard'
import { ControlPanel } from './components/ControlPanel'
import { SessionCard } from './components/SessionCard'
import { SessionDetail } from './components/SessionDetail'
import { useSessions, useJobs, useCreateJob } from './hooks/useElectron'
import { Session } from './types'

export default function App() {
  const { data: sessions = [] } = useSessions()
  const { data: jobs = [] } = useJobs()
  const createJob = useCreateJob()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showNewJobForm, setShowNewJobForm] = useState<number | null>(null)
  const [newJobPrompt, setNewJobPrompt] = useState('')

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
    <div className="min-h-screen bg-grid-background">
      {/* Barra superior arrastrable para mover la ventana */}
      <div className="draggable-header h-12 w-full fixed top-0 left-0 z-50 bg-transparent" />

      <main className="container mx-auto px-6 py-6 pt-14">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Panel de Control */}
          <div className="xl:col-span-1 space-y-6">
            <ControlPanel />

            {/* Sesiones Activas */}
            {sessions.length > 0 && (
              <div className="bg-card/90 backdrop-blur-xl border border-color rounded-xl shadow-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Sesiones Activas ({sessions.length})
                </h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      jobs={jobs}
                      onSelectSession={setSelectedSession}
                      onCreateJob={handleCreateJobForSession}
                      isSelected={selectedSession?.id === session.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel Principal */}
          <div className="xl:col-span-3">
            <div className="bg-card/90 backdrop-blur-xl border border-color rounded-xl shadow-2xl p-6 min-h-[600px]">
              <div className="flex items-center justify-between mb-8 draggable-header">
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <svg className="w-6 h-6 text-secondary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
                  </svg>
                  Task Board
                </h2>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-muted bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                    <span>Auto-refresh: 2s</span>
                  </div>

                  <div className="text-sm text-muted bg-accent/10 px-3 py-2 rounded-lg border border-accent/20">
                    Total Jobs: {jobs.length}
                  </div>
                </div>
              </div>

              <KanbanBoard />
            </div>
          </div>
        </div>

        {/* Efectos de fondo */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl opacity-30"></div>
          <div className="absolute top-3/4 left-1/2 w-96 h-96 bg-accent/20 rounded-full blur-3xl opacity-20"></div>
        </div>
      </main>

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
    </div>
  )
}
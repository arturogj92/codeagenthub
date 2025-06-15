import React from 'react'
import { ControlPanel } from './ControlPanel'
import { SessionCard } from './SessionCard'
import { Session, Job } from '../types'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  sessions: Session[]
  jobs: Job[]
  onCreateJob: (sessionId: number) => void
  onSelectSession: (session: Session) => void
  selectedSession: Session | null
}

export function Sidebar({ 
  collapsed, 
  onToggle, 
  sessions, 
  jobs, 
  onCreateJob, 
  onSelectSession, 
  selectedSession 
}: SidebarProps) {
  return (
    <div className="h-full bg-card/95 backdrop-blur-xl border-r border-color relative">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/80 transition-colors shadow-lg"
      >
        <svg 
          className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Content */}
      <div className={`h-full flex flex-col ${collapsed ? 'items-center' : ''}`}>
        {/* Header */}
        <div className={`p-4 border-b border-color/20 ${collapsed ? 'px-2' : ''}`}>
          {collapsed ? (
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
          ) : (
            <h2 className="text-lg font-bold text-white flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              Control Panel
            </h2>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {!collapsed && (
            <div className="p-4 space-y-6">
              {/* Control Panel */}
              <ControlPanel />
              
              {/* Sesiones Activas */}
              {sessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Sesiones ({sessions.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {sessions.map(session => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        jobs={jobs}
                        onSelectSession={onSelectSession}
                        onCreateJob={onCreateJob}
                        isSelected={selectedSession?.id === session.id}
                        compact={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Collapsed State Icons */}
          {collapsed && (
            <div className="p-2 space-y-4 mt-4">
              {/* Sessions icon */}
              {sessions.length > 0 && (
                <div className="relative group">
                  <button className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </button>
                  <div className="absolute top-0 right-0 -mr-1 -mt-1 w-5 h-5 bg-secondary text-white text-xs rounded-full flex items-center justify-center">
                    {sessions.length}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute left-12 top-0 bg-background border border-color rounded-lg px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {sessions.length} sesiones activas
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
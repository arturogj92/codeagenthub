import React from 'react';
import { Session, Job } from '../types';

interface SessionCardProps {
  session: Session;
  jobs: Job[];
  onSelectSession: (session: Session) => void;
  onCreateJob: (sessionId: number) => void;
  isSelected: boolean;
  compact?: boolean;
}

export function SessionCard({ session, jobs, onSelectSession, onCreateJob, isSelected, compact = false }: SessionCardProps) {
  const sessionJobs = jobs.filter(job => job.session_id === session.id);
  const runningJobs = sessionJobs.filter(job => job.status === 'RUNNING').length;
  const doneJobs = sessionJobs.filter(job => job.status === 'DONE').length;
  const errorJobs = sessionJobs.filter(job => job.status === 'ERROR').length;
  const queuedJobs = sessionJobs.filter(job => job.status === 'QUEUED').length;

  const getStatusColor = () => {
    if (runningJobs > 0) return 'border-primary/50 bg-primary/10';
    if (errorJobs > 0) return 'border-red-500/50 bg-red-500/10';
    if (doneJobs > 0 && queuedJobs === 0) return 'border-secondary/50 bg-secondary/10';
    return 'border-color bg-card/50';
  };

  if (compact) {
    return (
      <div 
        className={`p-2 rounded-lg border cursor-pointer transition-all duration-200 backdrop-blur-sm ${getStatusColor()} ${
          isSelected ? 'ring-1 ring-primary' : 'hover:bg-white/5'
        }`}
        onClick={() => onSelectSession(session)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
            <span className="text-xs font-medium text-white truncate">
              #{session.id}
            </span>
            {runningJobs > 0 && (
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse flex-shrink-0"></div>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {sessionJobs.length > 0 && (
              <span className="text-xs text-muted">{sessionJobs.length}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateJob(session.id);
              }}
              className="p-1 hover:bg-white/10 rounded text-xs"
              title="Nueva tarea"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 backdrop-blur-sm ${getStatusColor()} ${
        isSelected ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'hover:shadow-lg hover:scale-[1.01]'
      }`}
      onClick={() => onSelectSession(session)}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-white flex items-center">
            <svg className="w-4 h-4 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            #{session.id} - {session.agent}
          </h3>
          {runningJobs > 0 && (
            <div className="flex items-center space-x-1 bg-primary/20 px-2 py-1 rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-xs text-primary font-medium">Running</span>
            </div>
          )}
        </div>
        
        <div className="text-xs text-white/70 truncate bg-background/30 px-2 py-1 rounded">
          📁 {session.project.split('/').pop() || session.project}
        </div>
        
        <div className="text-xs text-muted bg-background/20 px-2 py-1 rounded">
          🌿 {session.branch}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-2 text-xs">
            {queuedJobs > 0 && (
              <span className="text-muted bg-muted/20 px-2 py-1 rounded-full flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {queuedJobs}
              </span>
            )}
            {runningJobs > 0 && (
              <span className="text-primary bg-primary/20 px-2 py-1 rounded-full flex items-center">
                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {runningJobs}
              </span>
            )}
            {doneJobs > 0 && (
              <span className="text-secondary bg-secondary/20 px-2 py-1 rounded-full flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {doneJobs}
              </span>
            )}
            {errorJobs > 0 && (
              <span className="text-red-400 bg-red-500/20 px-2 py-1 rounded-full flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {errorJobs}
              </span>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateJob(session.id);
            }}
            className="px-3 py-1 bg-gradient-to-r from-accent to-secondary text-white rounded-lg text-xs font-medium hover:from-accent/90 hover:to-secondary/90 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Task
          </button>
        </div>
        
        {session.started_at && (
          <div className="text-xs text-muted/70 bg-background/10 px-2 py-1 rounded text-center">
            ⏰ {new Date(session.started_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
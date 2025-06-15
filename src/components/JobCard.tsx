import React from 'react';
import { Job, JobStatus } from '../types';
import clsx from 'clsx';

interface JobCardProps {
  job: Job;
  onExecute?: () => void;
  onViewDetails?: () => void;
}

export function JobCard({ job, onExecute, onViewDetails }: JobCardProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCost = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const truncatePrompt = (prompt: string | undefined, maxLength: number = 60) => {
    if (!prompt) return 'No prompt';
    return prompt.length > maxLength ? `${prompt.slice(0, maxLength)}...` : prompt;
  };

  const getStatusColor = () => {
    switch (job.status) {
      case JobStatus.RUNNING:
        return 'border-primary/50 bg-primary/10';
      case JobStatus.DONE:
        return 'border-secondary/50 bg-secondary/10';
      case JobStatus.ERROR:
        return 'border-red-500/50 bg-red-500/10';
      default:
        return 'border-muted/30 bg-card/50';
    }
  };

  return (
    <div className={`backdrop-blur-sm p-4 rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${getStatusColor()}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-white font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              #{job.id}
            </span>
            {job.status === JobStatus.RUNNING && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-xs text-primary font-medium">Running</span>
              </div>
            )}
            {job.status === JobStatus.DONE && (
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs text-secondary font-medium">Done</span>
              </div>
            )}
            {job.status === JobStatus.ERROR && (
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-xs text-red-400 font-medium">Error</span>
              </div>
            )}
          </div>
        </div>
        
        <p className="text-sm text-white/90 leading-relaxed">
          {truncatePrompt(job.prompt)}
        </p>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted bg-background/30 px-2 py-1 rounded-full">
            Session #{job.session_id}
          </span>
          {job.experiment_id && (
            <span className="px-2 py-1 bg-accent/20 text-accent rounded-full text-xs font-medium border border-accent/30">
              Exp #{job.experiment_id}
            </span>
          )}
        </div>
        
        {(job.latency_ms > 0 || job.cost_cents > 0) && (
          <div className="flex items-center justify-between text-xs bg-background/20 rounded-lg p-2">
            {job.latency_ms > 0 && (
              <span className="text-white/70 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(job.latency_ms)}
              </span>
            )}
            {job.cost_cents > 0 && (
              <span className="text-accent flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                {formatCost(job.cost_cents)}
              </span>
            )}
          </div>
        )}
        
        {job.created_at && (
          <div className="text-xs text-muted">
            {new Date(job.created_at).toLocaleString()}
          </div>
        )}
        
        <div className="space-y-2 mt-3">
          {onExecute && (
            <button
              onClick={onExecute}
              className="w-full px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium rounded-lg hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ejecutar
            </button>
          )}
          
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="w-full px-4 py-2 bg-gradient-to-r from-accent/20 to-primary/20 border border-accent/30 text-white text-sm font-medium rounded-lg hover:from-accent/30 hover:to-primary/30 transition-all duration-200 flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver Detalles
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
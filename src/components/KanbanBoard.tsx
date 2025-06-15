import React, { useState } from 'react';
import { useJobs, useExecuteJob } from '../hooks/useElectron';
import { Job, JobStatus } from '../types';
import { JobCard } from './JobCard';
import { JobDetailModal } from './JobDetailModal';

const statusColumns = [
  { status: JobStatus.QUEUED, title: 'QUEUED', bgColor: 'bg-muted/20', textColor: 'text-muted', borderColor: 'border-muted/30' },
  { status: JobStatus.RUNNING, title: 'RUNNING', bgColor: 'bg-primary/20', textColor: 'text-primary', borderColor: 'border-primary/30' },
  { status: JobStatus.DONE, title: 'DONE', bgColor: 'bg-secondary/20', textColor: 'text-secondary', borderColor: 'border-secondary/30' },
  { status: JobStatus.ERROR, title: 'ERROR', bgColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
];

export function KanbanBoard() {
  const { data: jobs = [], isLoading } = useJobs();
  const executeJob = useExecuteJob();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const getJobsByStatus = (status: JobStatus) => 
    jobs.filter(job => job.status === status);

  const handleExecuteJob = (jobId: number) => {
    executeJob.mutate(jobId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
      {statusColumns.map(({ status, title, bgColor, textColor, borderColor }) => (
        <div key={status} className={`${bgColor} ${borderColor} backdrop-blur-sm border rounded-xl flex flex-col overflow-hidden`}>
          {/* Header fijo */}
          <div className="flex items-center justify-between p-4 border-b border-color/20 flex-shrink-0">
            <h3 className={`font-semibold ${textColor} flex items-center`}>
              {status === JobStatus.QUEUED && (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status === JobStatus.RUNNING && (
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {status === JobStatus.DONE && (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status === JobStatus.ERROR && (
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {title}
            </h3>
            <span className={`text-sm ${textColor} opacity-75 bg-background/50 px-2 py-1 rounded-full font-medium`}>
              {getJobsByStatus(status).length}
            </span>
          </div>
          
          {/* Contenido con scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {getJobsByStatus(status).length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted/50 text-sm">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  No hay tareas
                </div>
              </div>
            ) : (
              getJobsByStatus(status).map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onExecute={status === JobStatus.QUEUED ? () => handleExecuteJob(job.id) : undefined}
                  onViewDetails={() => {
                    console.log('Opening job details for job ID:', job.id);
                    setSelectedJobId(job.id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      ))}
      
      {/* Job Detail Modal */}
      {selectedJobId && (
        <>
          {console.log('Rendering JobDetailModal with jobId:', selectedJobId)}
          <JobDetailModal
            jobId={selectedJobId}
            isOpen={!!selectedJobId}
            onClose={() => setSelectedJobId(null)}
          />
        </>
      )}
    </div>
  );
}
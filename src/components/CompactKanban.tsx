import React, { useState } from 'react'
import { Job, JobStatus } from '../types'
import { useExecuteJob } from '../hooks/useElectron'

interface CompactKanbanProps {
  jobs: Job[]
}

interface CompactJobCardProps {
  job: Job
  onExecute?: () => void
  onViewDetails: () => void
}

function CompactJobCard({ job, onExecute, onViewDetails }: CompactJobCardProps) {
  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.QUEUED: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case JobStatus.RUNNING: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case JobStatus.DONE: return 'bg-green-500/20 text-green-400 border-green-500/30'
      case JobStatus.ERROR: return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case JobStatus.QUEUED:
        return <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case JobStatus.RUNNING:
        return <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      case JobStatus.DONE:
        return <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case JobStatus.ERROR:
        return <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
  }

  return (
    <div className={`p-2 border rounded-lg hover:shadow-md transition-all cursor-pointer group ${getStatusColor(job.status)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {getStatusIcon(job.status)}
          <span className="text-xs font-medium truncate">
            Job #{job.id}
          </span>
          <span className="text-xs opacity-75">
            {job.prompt?.substring(0, 30)}...
          </span>
        </div>
        
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onExecute && (
            <button
              onClick={(e) => { e.stopPropagation(); onExecute(); }}
              className="p-1 hover:bg-white/10 rounded text-xs"
              title="Ejecutar"
            >
              ▶
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="p-1 hover:bg-white/10 rounded text-xs"
            title="Ver detalles"
          >
            👁
          </button>
        </div>
      </div>
    </div>
  )
}

export function CompactKanban({ jobs }: CompactKanbanProps) {
  const executeJob = useExecuteJob()
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  const getJobsByStatus = (status: JobStatus) => 
    jobs.filter(job => job.status === status)

  const handleExecuteJob = (jobId: number) => {
    console.log('=== EXECUTING JOB ===')
    console.log('Job ID:', jobId)
    console.log('executeJob object:', executeJob)
    console.log('executeJob.mutate:', executeJob.mutate)
    
    try {
      executeJob.mutate(jobId, {
        onSuccess: () => {
          console.log('Job execution started successfully')
        },
        onError: (error) => {
          console.error('Job execution failed:', error)
          alert('Error executing job: ' + error)
        }
      })
    } catch (error) {
      console.error('Error in handleExecuteJob:', error)
      alert('Error executing job: ' + error)
    }
  }

  const statusColumns = [
    { status: JobStatus.QUEUED, title: 'QUEUED', count: getJobsByStatus(JobStatus.QUEUED).length },
    { status: JobStatus.RUNNING, title: 'RUNNING', count: getJobsByStatus(JobStatus.RUNNING).length },
    { status: JobStatus.DONE, title: 'DONE', count: getJobsByStatus(JobStatus.DONE).length },
    { status: JobStatus.ERROR, title: 'ERROR', count: getJobsByStatus(JobStatus.ERROR).length },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-color/20">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          Task Queue
        </h3>
        
        <div className="flex items-center space-x-4">
          {statusColumns.map(({ status, title, count }) => (
            <div key={status} className="flex items-center space-x-1 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                status === JobStatus.QUEUED ? 'bg-yellow-400' :
                status === JobStatus.RUNNING ? 'bg-blue-400' :
                status === JobStatus.DONE ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <span className="text-muted">{title}: {count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-4 gap-4 h-full">
          {statusColumns.map(({ status, title }) => (
            <div key={status} className="flex flex-col">
              <h4 className="text-sm font-medium text-muted mb-2 flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  status === JobStatus.QUEUED ? 'bg-yellow-400' :
                  status === JobStatus.RUNNING ? 'bg-blue-400' :
                  status === JobStatus.DONE ? 'bg-green-400' : 'bg-red-400'
                }`} />
                {title}
              </h4>
              
              <div className="space-y-2 flex-1 overflow-y-auto">
                {getJobsByStatus(status).length === 0 ? (
                  <div className="text-center text-muted/50 text-xs py-4">
                    No hay tareas
                  </div>
                ) : (
                  getJobsByStatus(status).map(job => (
                    <CompactJobCard
                      key={job.id}
                      job={job}
                      onExecute={status === JobStatus.QUEUED ? () => handleExecuteJob(job.id) : undefined}
                      onViewDetails={() => setSelectedJobId(job.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
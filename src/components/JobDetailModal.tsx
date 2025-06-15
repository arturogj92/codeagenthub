import React, { useEffect, useRef, useState } from 'react';
import { useJobDetails } from '../hooks/useElectron';
import { JobStatus, Message } from '../types';

interface MessageComponentProps {
  message: Message;
  index: number;
}

function MessageComponent({ message, index }: MessageComponentProps) {
  const isLongMessage = (message.content?.length || 0) > 500;
  const [isExpanded, setIsExpanded] = useState(!isLongMessage);

  return (
    <div key={message.id || index} className="bg-background/30 rounded-lg border border-color/30">
      <div className="flex items-center justify-between p-3 border-b border-color/20">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            message.role === 'user' 
              ? 'bg-primary/20 text-primary' 
              : message.role === 'assistant' 
              ? 'bg-secondary/20 text-secondary'
              : 'bg-muted/20 text-muted'
          }`}>
            {message.role === 'user' ? '👤 Usuario' : 
             message.role === 'assistant' ? '🤖 Claude' : 
             '⚙️ Sistema'}
          </span>
          {isLongMessage && (
            <span className="text-xs text-muted bg-background/50 px-2 py-1 rounded">
              {(message.content?.length || 0).toLocaleString()} caracteres
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {message.ts && (
            <span className="text-xs text-muted">
              {new Date(message.ts).toLocaleTimeString()}
            </span>
          )}
          {isLongMessage && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary/80 flex items-center space-x-1"
            >
              <span>{isExpanded ? 'Colapsar' : 'Expandir'}</span>
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="p-3">
        <pre className="text-sm text-white whitespace-pre-wrap font-mono leading-relaxed overflow-hidden">
          {isExpanded 
            ? message.content || '' 
            : (message.content || '').slice(0, 500) + (isLongMessage ? '...' : '')
          }
        </pre>
      </div>
    </div>
  );
}

interface JobDetailModalProps {
  jobId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function JobDetailModal({ jobId, isOpen, onClose }: JobDetailModalProps) {
  const { data: jobDetails, isLoading, error } = useJobDetails(jobId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageFilter, setMessageFilter] = useState<'all' | 'user' | 'assistant' | 'system'>('all');

  // Debug logging
  console.log('=== JOB DETAIL MODAL DEBUG ===');
  console.log('jobId:', jobId);
  console.log('isOpen:', isOpen);
  console.log('isLoading:', isLoading);
  console.log('error:', error);
  console.log('jobDetails:', jobDetails);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobDetails?.messages]);

  if (!isOpen) return null;


  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCost = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.RUNNING:
        return 'text-primary border-primary/50 bg-primary/10';
      case JobStatus.DONE:
        return 'text-secondary border-secondary/50 bg-secondary/10';
      case JobStatus.ERROR:
        return 'text-red-400 border-red-500/50 bg-red-500/10';
      default:
        return 'text-muted border-muted/30 bg-card/50';
    }
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case JobStatus.RUNNING:
        return (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Ejecutando...</span>
          </div>
        );
      case JobStatus.DONE:
        return (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Completado</span>
          </div>
        );
      case JobStatus.ERROR:
        return (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-sm font-medium">Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">En cola</span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-color rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-color">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Tarea #{jobId}
            </h2>
            {jobDetails && (
              <div className={`px-3 py-1 rounded-full border ${getStatusColor(jobDetails.status)}`}>
                {getStatusIcon(jobDetails.status)}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(90vh-100px)]">
          
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-white text-sm">Cargando detalles de la tarea #{jobId}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-6 text-red-400 text-center">
              <div className="space-y-2">
                <p>❌ Error cargando los detalles de la tarea</p>
                <p className="text-sm text-muted">{error}</p>
                <button 
                  onClick={onClose}
                  className="text-primary hover:text-primary/80 underline"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && !jobDetails && (
            <div className="p-6 text-center text-muted">
              <p>No se encontraron detalles para la tarea #{jobId}</p>
            </div>
          )}

          {!isLoading && !error && jobDetails && (
            <>
              {/* Job Info */}
              <div className="p-6 border-b border-color">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted mb-2">Prompt</h3>
                      <p className="text-white bg-background/30 p-3 rounded-lg text-sm leading-relaxed">
                        {jobDetails.prompt || 'Sin prompt'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted mb-2">Proyecto</h3>
                      <p className="text-white bg-background/30 p-2 rounded text-sm">
                        📁 {jobDetails.project.split('/').pop() || jobDetails.project}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-muted mb-2">Agente</h3>
                        <p className="text-white bg-background/30 p-2 rounded text-sm">
                          {jobDetails.agent}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted mb-2">Rama</h3>
                        <p className="text-white bg-background/30 p-2 rounded text-sm">
                          🌿 {jobDetails.branch}
                        </p>
                      </div>
                    </div>
                    
                    {(jobDetails.latency_ms > 0 || jobDetails.cost_cents > 0) && (
                      <div className="flex items-center justify-between text-sm bg-background/20 rounded-lg p-3">
                        {jobDetails.latency_ms > 0 && (
                          <span className="text-white/70 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDuration(jobDetails.latency_ms)}
                          </span>
                        )}
                        {jobDetails.cost_cents > 0 && (
                          <span className="text-accent flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            {formatCost(jobDetails.cost_cents)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages / Logs */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-color">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Logs de Ejecución
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-muted">Filtrar:</label>
                      <select
                        value={messageFilter}
                        onChange={(e) => setMessageFilter(e.target.value as any)}
                        className="select-dark text-xs px-2 py-1 rounded"
                      >
                        <option value="all">Todos ({jobDetails.messages.length})</option>
                        <option value="user">👤 Usuario ({jobDetails.messages.filter(m => m.role === 'user').length})</option>
                        <option value="assistant">🤖 Claude ({jobDetails.messages.filter(m => m.role === 'assistant').length})</option>
                        <option value="system">⚙️ Sistema ({jobDetails.messages.filter(m => m.role === 'system').length})</option>
                      </select>
                    </div>
                    <button
                      onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="text-xs text-primary hover:text-primary/80 flex items-center space-x-1 bg-primary/10 px-2 py-1 rounded"
                    >
                      <span>Ir al final</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96">
                  {jobDetails.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted/50">
                      <div className="text-center">
                        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-sm">No hay mensajes aún</p>
                      </div>
                    </div>
                  ) : (
                    jobDetails.messages
                      .filter(message => messageFilter === 'all' || message.role === messageFilter)
                      .map((message, index) => (
                        <MessageComponent 
                          key={message.id || index} 
                          message={message} 
                          index={index} 
                        />
                      ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
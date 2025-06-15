import React, { useState } from 'react';
import { useSessions, useCreateSession, useCreateJob, useDirectoryDialog } from '../hooks/useElectron';

export function ControlPanel() {
  const { data: sessions = [] } = useSessions();
  const createSession = useCreateSession();
  const createJob = useCreateJob();
  const directoryDialog = useDirectoryDialog();
  
  const [newSessionForm, setNewSessionForm] = useState({
    project: '',
    agent: 'claude_sub',
  });
  
  const [newJobForm, setNewJobForm] = useState({
    sessionId: '',
    prompt: '',
  });
  
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewJob, setShowNewJob] = useState(false);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating session with:', newSessionForm);
    
    // Debug electronAPI availability
    console.log('=== CREATE SESSION DEBUG ===');
    console.log('window.electronAPI:', window.electronAPI);
    console.log('electronAPI methods:', window.electronAPI ? Object.keys(window.electronAPI) : 'undefined');
    console.log('createSession available:', !!window.electronAPI?.createSession);
    console.log('createSession type:', typeof window.electronAPI?.createSession);
    
    createSession.mutate(newSessionForm, {
      onSuccess: (data) => {
        console.log('Session created successfully:', data);
        setNewSessionForm({ project: '', agent: 'claude_sub' });
        setShowNewSession(false);
      },
      onError: (error) => {
        console.error('Error creating session:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        alert(`Error creando sesión:\n\n${errorMsg}\n\nAsegúrate de que:\n- La ruta del proyecto existe\n- Tienes permisos de escritura`);
      },
    });
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    createJob.mutate({
      session_id: parseInt(newJobForm.sessionId),
      prompt: newJobForm.prompt,
    }, {
      onSuccess: () => {
        setNewJobForm({ sessionId: '', prompt: '' });
        setShowNewJob(false);
      },
    });
  };

  const handleOpenDirectoryDialog = async () => {
    console.log('=== DEBUG: handleOpenDirectoryDialog called ===');
    console.log('window.electronAPI:', window.electronAPI);
    console.log('typeof require:', typeof (window as any).require);
    
    // Try electronAPI first
    if (window.electronAPI?.openDirectoryDialog) {
      console.log('Using electronAPI.openDirectoryDialog');
      try {
        const result = await window.electronAPI.openDirectoryDialog();
        console.log('ElectronAPI result:', result);
        if (result) {
          setNewSessionForm({ ...newSessionForm, project: result });
        }
        return;
      } catch (error) {
        console.error('ElectronAPI failed:', error);
      }
    }
    
    // Try direct require (development mode with nodeIntegration enabled)
    if (typeof (window as any).require !== 'undefined') {
      console.log('Using direct require approach');
      try {
        const { ipcRenderer } = (window as any).require('electron');
        console.log('ipcRenderer obtained:', !!ipcRenderer);
        const result = await ipcRenderer.invoke('open-directory-dialog');
        console.log('Direct IPC result:', result);
        if (result) {
          setNewSessionForm({ ...newSessionForm, project: result });
        }
        return;
      } catch (error) {
        console.error('Direct require failed:', error);
      }
    }
    
    console.error('No directory dialog methods available');
    console.error('Available on window:', Object.keys(window).filter(k => k.includes('electron') || k.includes('ipc')));
    alert('Directory dialog not available. Please enter the path manually.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-card/90 backdrop-blur-xl border border-color rounded-xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold mb-6 text-white flex items-center">
          <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
          Control Panel
        </h2>
        
        <div className="space-y-4">
          <div className="gradient-border">
            <button
              onClick={() => setShowNewSession(!showNewSession)}
              className="gradient-border-content w-full gradient-purple-intense text-white px-4 py-3 rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Nueva Sesión
            </button>
          </div>
          
          {showNewSession && (
            <div className="bg-background/50 backdrop-blur-sm border border-color rounded-lg p-4 space-y-4">
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Proyecto (ruta)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newSessionForm.project}
                      onChange={(e) => setNewSessionForm({ ...newSessionForm, project: e.target.value })}
                      className="flex-1 input-dark px-3 py-2 rounded-lg"
                      placeholder="/path/to/project"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleOpenDirectoryDialog}
                      disabled={directoryDialog.isPending}
                      className="px-3 py-2 bg-accent/20 border border-accent/50 rounded-lg text-accent hover:bg-accent/30 transition-colors flex items-center justify-center disabled:opacity-50 whitespace-nowrap min-w-[100px]"
                    >
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="text-sm font-medium">
                        {directoryDialog.isPending ? 'Abriendo...' : 'Examinar'}
                      </span>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Agente
                  </label>
                  <select
                    value={newSessionForm.agent}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, agent: e.target.value })}
                    className="w-full select-dark px-3 py-2 rounded-lg"
                  >
                    <option value="claude_sub">Claude Subscription</option>
                    <option value="claude_api">Claude API</option>
                    <option value="codex_cli">Codex CLI</option>
                  </select>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createSession.isPending}
                    className="flex-1 bg-gradient-to-r from-secondary to-primary text-white px-4 py-2 rounded-lg font-medium hover:from-secondary/90 hover:to-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {createSession.isPending ? 'Creando...' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewSession(false)}
                    className="px-4 py-2 border border-color rounded-lg text-muted hover:bg-border/50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="gradient-border">
            <button
              onClick={() => setShowNewJob(!showNewJob)}
              className="gradient-border-content w-full gradient-purple text-white px-4 py-3 rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={sessions.length === 0}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Nueva Tarea
            </button>
          </div>
          
          {showNewJob && (
            <div className="bg-background/50 backdrop-blur-sm border border-color rounded-lg p-4 space-y-4">
              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Sesión
                  </label>
                  <select
                    value={newJobForm.sessionId}
                    onChange={(e) => setNewJobForm({ ...newJobForm, sessionId: e.target.value })}
                    className="w-full select-dark px-3 py-2 rounded-lg"
                    required
                  >
                    <option value="">Seleccionar sesión...</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        #{session.id} - {session.agent} ({session.project.split('/').pop()})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Prompt
                  </label>
                  <textarea
                    value={newJobForm.prompt}
                    onChange={(e) => setNewJobForm({ ...newJobForm, prompt: e.target.value })}
                    className="w-full input-dark px-3 py-3 rounded-lg resize-none"
                    rows={3}
                    placeholder="Descripción de la tarea..."
                    required
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={createJob.isPending}
                    className="flex-1 bg-gradient-to-r from-secondary to-primary text-white px-4 py-2 rounded-lg font-medium hover:from-secondary/90 hover:to-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {createJob.isPending ? 'Creando...' : 'Crear Tarea'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewJob(false)}
                    className="px-4 py-2 border border-color rounded-lg text-muted hover:bg-border/50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
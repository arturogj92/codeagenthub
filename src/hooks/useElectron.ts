import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Session, Job, CreateSessionRequest, CreateJobRequest, JobDetails, Message } from '../types';

// Type for the electron API
declare global {
  interface Window {
    electronAPI: {
      // Session operations
      getSessions: () => Promise<Session[]>;
      createSession: (project: string, agent: string) => Promise<number>;
      
      // Job operations
      getJobs: () => Promise<Job[]>;
      createJob: (sessionId: number, prompt: string, experimentId?: number) => Promise<number>;
      executeJob: (jobId: number) => Promise<void>;
      updateJobStatus: (jobId: number, status: string, costCents?: number, latencyMs?: number) => Promise<void>;
      
      // Message and details
      getJobMessages: (jobId: number) => Promise<Message[]>;
      getJobDetails: (jobId: number) => Promise<JobDetails>;
      
      // Confirmations
      getPendingConfirmations: (jobId: number) => Promise<any[]>;
      respondToConfirmation: (confirmationId: number, approved: boolean) => Promise<void>;
      
      // Git operations
      gitPull: (worktreePath: string) => Promise<string>;
      gitAddAll: (worktreePath: string) => Promise<string>;
      gitCommit: (worktreePath: string, message: string) => Promise<string>;
      gitPush: (worktreePath: string, branch: string) => Promise<string>;
      gitDiff: (worktreePath: string) => Promise<string>;
      gitStatus: (worktreePath: string) => Promise<string>;
      
      // File operations
      listWorktreeFiles: (worktreePath: string) => Promise<string[]>;
      openDirectoryDialog: () => Promise<string | null>;
      
      // Event listeners for real-time updates
      onJobStatusUpdate: (callback: (event: any, data: any) => void) => () => void;
      onJobMessage: (callback: (event: any, data: any) => void) => () => void;
      onJobConfirmation: (callback: (event: any, data: any) => void) => () => void;
    };
  }
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      // Try electronAPI first
      if (window.electronAPI?.getSessions) {
        return await window.electronAPI.getSessions();
      }
      
      // Fallback to direct require
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron');
        return await ipcRenderer.invoke('get-sessions');
      }
      
      throw new Error('No IPC method available for getSessions');
    },
  });
}

export function useJobs() {
  const queryClient = useQueryClient();
  
  // Set up real-time updates when component mounts
  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.onJobStatusUpdate?.((event, data) => {
      // Invalidate jobs query when job status changes
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    });
    
    return unsubscribe;
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      // Try electronAPI first
      if (window.electronAPI?.getJobs) {
        return await window.electronAPI.getJobs();
      }
      
      // Fallback to direct require
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron');
        return await ipcRenderer.invoke('get-jobs');
      }
      
      throw new Error('No IPC method available for getJobs');
    },
    // NO refetchInterval - solo updates manuales o por eventos
    staleTime: Infinity, // Data never considered stale
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Solo al montar inicialmente
    refetchOnReconnect: false,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      console.log('Creating session with:', data);
      
      // Try electronAPI first
      if (window.electronAPI?.createSession) {
        try {
          const result = await window.electronAPI.createSession(data.project, data.agent);
          console.log('create session result (electronAPI):', result);
          return result;
        } catch (error) {
          console.error('electronAPI createSession failed:', error);
        }
      }
      
      // Fallback to direct require (like directory dialog)
      if (typeof (window as any).require !== 'undefined') {
        console.log('Using direct require for createSession');
        try {
          const { ipcRenderer } = (window as any).require('electron');
          const result = await ipcRenderer.invoke('create-session', data.project, data.agent);
          console.log('create session result (direct IPC):', result);
          return result;
        } catch (error) {
          console.error('Direct IPC createSession failed:', error);
          throw error;
        }
      }
      
      throw new Error('No IPC method available for createSession');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateJobRequest) => {
      // Try electronAPI first
      if (window.electronAPI?.createJob) {
        return await window.electronAPI.createJob(data.session_id, data.prompt, data.experiment_id);
      }
      
      // Fallback to direct require
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron');
        return await ipcRenderer.invoke('create-job', data.session_id, data.prompt, data.experiment_id);
      }
      
      throw new Error('No IPC method available for createJob');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useExecuteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: number) => {
      console.log('=== useExecuteJob mutationFn called ===');
      console.log('Job ID:', jobId);
      console.log('window.electronAPI:', window.electronAPI);
      console.log('executeJob available:', !!window.electronAPI?.executeJob);
      
      // Try electronAPI first
      if (window.electronAPI?.executeJob) {
        console.log('Using electronAPI.executeJob');
        try {
          const result = await window.electronAPI.executeJob(jobId);
          console.log('electronAPI.executeJob result:', result);
          return result;
        } catch (error) {
          console.error('electronAPI.executeJob failed:', error);
          throw error;
        }
      }
      
      // Fallback to direct require
      if (typeof (window as any).require !== 'undefined') {
        console.log('Using direct require for executeJob');
        try {
          const { ipcRenderer } = (window as any).require('electron');
          console.log('Got ipcRenderer, calling execute-job');
          const result = await ipcRenderer.invoke('execute-job', jobId);
          console.log('Direct IPC executeJob result:', result);
          return result;
        } catch (error) {
          console.error('Direct IPC executeJob failed:', error);
          throw error;
        }
      }
      
      throw new Error('No IPC method available for executeJob');
    },
    onSuccess: () => {
      console.log('Job execution successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      console.error('useExecuteJob mutation error:', error);
    }
  });
}

export function useJobDetails(jobId?: number) {
  return useQuery({
    queryKey: ['job-details', jobId],
    queryFn: async () => {
      console.log('=== useJobDetails queryFn ===');
      console.log('jobId:', jobId);
      
      if (!jobId) {
        console.error('Job ID is required');
        throw new Error('Job ID is required');
      }
      
      // Try electronAPI first
      if (window.electronAPI?.getJobDetails) {
        console.log('Using electronAPI.getJobDetails');
        try {
          const result = await window.electronAPI.getJobDetails(jobId);
          console.log('electronAPI result:', result);
          return result;
        } catch (error) {
          console.error('electronAPI failed:', error);
        }
      }
      
      // Fallback to direct require
      if (typeof (window as any).require !== 'undefined') {
        console.log('Using direct require for getJobDetails');
        try {
          const { ipcRenderer } = (window as any).require('electron');
          const result = await ipcRenderer.invoke('get-job-details', jobId);
          console.log('Direct IPC result:', result);
          return result;
        } catch (error) {
          console.error('Direct IPC failed:', error);
          throw error;
        }
      }
      
      throw new Error('No IPC method available for getJobDetails');
    },
    enabled: !!jobId,
  });
}

export function useJobMessages(jobId?: number) {
  return useQuery({
    queryKey: ['job-messages', jobId],
    queryFn: () => window.electronAPI.getJobMessages(jobId!),
    enabled: !!jobId,
    refetchInterval: 3000, // Reduced to every 3 seconds
    staleTime: 500, // Consider data fresh for 500ms
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useGitOperations() {
  return {
    gitPull: (worktreePath: string) => 
      window.electronAPI.gitPull(worktreePath),
    
    gitAddAll: (worktreePath: string) => 
      window.electronAPI.gitAddAll(worktreePath),
    
    gitCommit: (worktreePath: string, message: string) => 
      window.electronAPI.gitCommit(worktreePath, message),
    
    gitPush: (worktreePath: string, branch: string) => 
      window.electronAPI.gitPush(worktreePath, branch),
    
    gitDiff: (worktreePath: string) => 
      window.electronAPI.gitDiff(worktreePath),
    
    gitStatus: (worktreePath: string) => 
      window.electronAPI.gitStatus(worktreePath),
  };
}

export function useDirectoryDialog() {
  return useMutation({
    mutationFn: () => {
      console.log('window.electronAPI:', window.electronAPI);
      console.log('openDirectoryDialog available:', !!window.electronAPI?.openDirectoryDialog);
      
      if (!window.electronAPI?.openDirectoryDialog) {
        throw new Error('electronAPI.openDirectoryDialog is not available');
      }
      
      return window.electronAPI.openDirectoryDialog();
    },
  });
}

export function usePendingConfirmations(jobId?: number) {
  return useQuery({
    queryKey: ['pending-confirmations', jobId],
    queryFn: () => window.electronAPI.getPendingConfirmations(jobId!),
    enabled: !!jobId,
    refetchInterval: 2000, // Check for confirmations every 2 seconds
  });
}

export function useRespondToConfirmation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ confirmationId, approved }: { confirmationId: number; approved: boolean }) =>
      window.electronAPI.respondToConfirmation(confirmationId, approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-confirmations'] });
    },
  });
}
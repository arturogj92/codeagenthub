import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Hook para obtener sesiones activas de Claude
export function useActiveClaudeSessions() {
  return useQuery({
    queryKey: ['active-claude-sessions'],
    queryFn: async () => {
      if (window.electronAPI?.getActiveClaudeSessions) {
        return await window.electronAPI.getActiveClaudeSessions()
      }
      
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron')
        return await ipcRenderer.invoke('get-active-claude-sessions')
      }
      
      throw new Error('No IPC method available for getActiveClaudeSessions')
    },
    refetchInterval: 3000, // Refresh every 3 seconds
    staleTime: 1000
  })
}

// Hook para obtener output de una sesión de Claude
export function useClaudeSessionOutput(sessionId?: string, lines = 50) {
  return useQuery({
    queryKey: ['claude-session-output', sessionId, lines],
    queryFn: async () => {
      if (!sessionId) return ''
      
      if (window.electronAPI?.getClaudeSessionOutput) {
        return await window.electronAPI.getClaudeSessionOutput(sessionId, lines)
      }
      
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron')
        return await ipcRenderer.invoke('get-claude-session-output', sessionId, lines)
      }
      
      throw new Error('No IPC method available for getClaudeSessionOutput')
    },
    enabled: !!sessionId,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    staleTime: 500
  })
}

// Hook para enviar prompts a Claude
export function useSendPromptToClaude() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ sessionId, prompt }: { sessionId: string; prompt: string }) => {
      if (window.electronAPI?.sendPromptToClaude) {
        return await window.electronAPI.sendPromptToClaude(sessionId, prompt)
      }
      
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron')
        return await ipcRenderer.invoke('send-prompt-to-claude', sessionId, prompt)
      }
      
      throw new Error('No IPC method available for sendPromptToClaude')
    },
    onSuccess: (_, { sessionId }) => {
      // Invalidate session output to get immediate updates
      queryClient.invalidateQueries({ queryKey: ['claude-session-output', sessionId] })
    }
  })
}

// Hook para terminar sesión de Claude
export function useTerminateClaudeSession() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (window.electronAPI?.terminateClaudeSession) {
        return await window.electronAPI.terminateClaudeSession(sessionId)
      }
      
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron')
        return await ipcRenderer.invoke('terminate-claude-session', sessionId)
      }
      
      throw new Error('No IPC method available for terminateClaudeSession')
    },
    onSuccess: () => {
      // Refresh active sessions list
      queryClient.invalidateQueries({ queryKey: ['active-claude-sessions'] })
    }
  })
}

// Hook para obtener confirmaciones pendientes
export function useAllPendingConfirmations() {
  return useQuery({
    queryKey: ['all-pending-confirmations'],
    queryFn: async () => {
      if (window.electronAPI?.getAllPendingConfirmations) {
        return await window.electronAPI.getAllPendingConfirmations()
      }
      
      if (typeof (window as any).require !== 'undefined') {
        const { ipcRenderer } = (window as any).require('electron')
        return await ipcRenderer.invoke('get-all-pending-confirmations')
      }
      
      throw new Error('No IPC method available for getAllPendingConfirmations')
    },
    refetchInterval: 2000, // Check for confirmations frequently
    staleTime: 500
  })
}
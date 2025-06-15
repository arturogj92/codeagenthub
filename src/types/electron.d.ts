// Tipos para la API de Electron expuesta en el renderer
export interface ElectronAPI {
  // Session operations
  getSessions: () => Promise<any[]>
  createSession: (project: string, agent: string) => Promise<number>
  
  // Job operations
  getJobs: () => Promise<any[]>
  createJob: (sessionId: number, prompt: string, experimentId?: number) => Promise<number>
  executeJob: (jobId: number) => Promise<{ success: boolean }>
  updateJobStatus: (jobId: number, status: string, costCents?: number, latencyMs?: number) => Promise<void>
  
  // Message and details
  getJobMessages: (jobId: number) => Promise<any[]>
  getJobDetails: (jobId: number) => Promise<any>
  
  // Confirmations
  getPendingConfirmations: (jobId: number) => Promise<any[]>
  respondToConfirmation: (confirmationId: number, approved: boolean) => Promise<void>
  
  // Git operations
  gitPull: (worktreePath: string) => Promise<any>
  gitAddAll: (worktreePath: string) => Promise<any>
  gitCommit: (worktreePath: string, message: string) => Promise<any>
  gitPush: (worktreePath: string, branch: string) => Promise<any>
  gitDiff: (worktreePath: string) => Promise<string>
  gitStatus: (worktreePath: string) => Promise<any>
  
  // File operations
  listWorktreeFiles: (worktreePath: string) => Promise<string[]>
  openDirectoryDialog: () => Promise<string | null>
  
  // Claude Interactive Mode operations
  getActiveClaudeSessions: () => Promise<any[]>
  getClaudeSessionOutput: (sessionId: string, lines?: number) => Promise<string[]>
  sendPromptToClaude: (sessionId: string, prompt: string) => Promise<boolean>
  getAllPendingConfirmations: () => Promise<any[]>
  terminateClaudeSession: (sessionId: string) => Promise<boolean>
  
  // Event listeners for real-time updates
  onJobStatusUpdate: (callback: (event: any, data: any) => void) => () => void
  onJobMessage: (callback: (event: any, data: any) => void) => () => void
  onJobConfirmation: (callback: (event: any, data: any) => void) => () => void
  
  // Claude Interactive Events
  onClaudeConfirmationRequired: (callback: (event: any, data: any) => void) => () => void
  onClaudeSessionCreated: (callback: (event: any, data: any) => void) => () => void
  onClaudeSessionEnded: (callback: (event: any, data: any) => void) => () => void
  
  // Tmux operations
  tmuxCreateSession: (options: {
    sessionId: string
    workingDirectory: string
    claudeSessionId?: string
  }) => Promise<string>
  tmuxSendCommand: (sessionId: string, command: string) => Promise<boolean>
  tmuxGetOutput: (sessionId: string, lines?: number) => Promise<string>
  tmuxRespondConfirmation: (sessionId: string, confirm: boolean) => Promise<boolean>
  tmuxTerminateSession: (sessionId: string) => Promise<boolean>
  tmuxListSessions: () => Promise<any[]>
  tmuxCycleModes: (sessionId: string) => Promise<boolean>
  
  // Tmux events
  onTmuxConfirmationRequired: (callback: (event: any, data: any) => void) => () => void
  onTmuxSessionEnded: (callback: (event: any, data: any) => void) => () => void
  onTmuxSessionError: (callback: (event: any, data: any) => void) => () => void
  onTmuxCommandSent: (callback: (event: any, data: any) => void) => () => void
  onTmuxModeChanged: (callback: (event: any, data: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
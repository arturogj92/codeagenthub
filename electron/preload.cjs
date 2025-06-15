const { ipcRenderer } = require('electron');

console.log('Preload script loading...');

// Direct API injection (no contextBridge since contextIsolation is false)
window.electronAPI = {
  // Session operations
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  createSession: (project, agent) => ipcRenderer.invoke('create-session', project, agent),
  
  // Job operations
  getJobs: () => ipcRenderer.invoke('get-jobs'),
  createJob: (sessionId, prompt, experimentId) => ipcRenderer.invoke('create-job', sessionId, prompt, experimentId),
  executeJob: (jobId) => ipcRenderer.invoke('execute-job', jobId),
  updateJobStatus: (jobId, status, costCents, latencyMs) => ipcRenderer.invoke('update-job-status', jobId, status, costCents, latencyMs),
  
  // Message and details
  getJobMessages: (jobId) => ipcRenderer.invoke('get-job-messages', jobId),
  getJobDetails: (jobId) => ipcRenderer.invoke('get-job-details', jobId),
  
  // Confirmations
  getPendingConfirmations: (jobId) => ipcRenderer.invoke('get-pending-confirmations', jobId),
  respondToConfirmation: (confirmationId, approved) => ipcRenderer.invoke('respond-to-confirmation', confirmationId, approved),
  
  // Git operations
  gitPull: (worktreePath) => ipcRenderer.invoke('git-pull', worktreePath),
  gitAddAll: (worktreePath) => ipcRenderer.invoke('git-add-all', worktreePath),
  gitCommit: (worktreePath, message) => ipcRenderer.invoke('git-commit', worktreePath, message),
  gitPush: (worktreePath, branch) => ipcRenderer.invoke('git-push', worktreePath, branch),
  gitDiff: (worktreePath) => ipcRenderer.invoke('git-diff', worktreePath),
  gitStatus: (worktreePath) => ipcRenderer.invoke('git-status', worktreePath),
  
  // File operations
  listWorktreeFiles: (worktreePath) => ipcRenderer.invoke('list-worktree-files', worktreePath),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  // Claude Interactive Mode operations
  getActiveClaudeSessions: () => ipcRenderer.invoke('get-active-claude-sessions'),
  getClaudeSessionOutput: (sessionId, lines) => ipcRenderer.invoke('get-claude-session-output', sessionId, lines),
  sendPromptToClaude: (sessionId, prompt) => ipcRenderer.invoke('send-prompt-to-claude', sessionId, prompt),
  getAllPendingConfirmations: () => ipcRenderer.invoke('get-all-pending-confirmations'),
  terminateClaudeSession: (sessionId) => ipcRenderer.invoke('terminate-claude-session', sessionId),
  
  // Event listeners for real-time updates
  onJobStatusUpdate: (callback) => {
    ipcRenderer.on('job-status-update', callback);
    return () => ipcRenderer.removeListener('job-status-update', callback);
  },
  
  onJobMessage: (callback) => {
    ipcRenderer.on('job-message', callback);
    return () => ipcRenderer.removeListener('job-message', callback);
  },
  
  onJobConfirmation: (callback) => {
    ipcRenderer.on('job-confirmation', callback);
    return () => ipcRenderer.removeListener('job-confirmation', callback);
  },
  
  // Claude Interactive Events
  onClaudeConfirmationRequired: (callback) => {
    ipcRenderer.on('claude-confirmation-required', callback);
    return () => ipcRenderer.removeListener('claude-confirmation-required', callback);
  },
  
  onClaudeSessionCreated: (callback) => {
    ipcRenderer.on('claude-session-created', callback);
    return () => ipcRenderer.removeListener('claude-session-created', callback);
  },
  
  onClaudeSessionEnded: (callback) => {
    ipcRenderer.on('claude-session-ended', callback);
    return () => ipcRenderer.removeListener('claude-session-ended', callback);
  },
  
  // Tmux operations
  tmuxCreateSession: (options) => ipcRenderer.invoke('tmux-create-session', options),
  tmuxSendCommand: (sessionId, command) => ipcRenderer.invoke('tmux-send-command', sessionId, command),
  tmuxGetOutput: (sessionId, lines) => ipcRenderer.invoke('tmux-get-output', sessionId, lines),
  tmuxRespondConfirmation: (sessionId, confirm) => ipcRenderer.invoke('tmux-respond-confirmation', sessionId, confirm),
  tmuxTerminateSession: (sessionId) => ipcRenderer.invoke('tmux-terminate-session', sessionId),
  tmuxListSessions: () => ipcRenderer.invoke('tmux-list-sessions'),
  tmuxCycleModes: (sessionId) => ipcRenderer.invoke('tmux-cycle-modes', sessionId),
  
  // Tmux events
  onTmuxConfirmationRequired: (callback) => {
    ipcRenderer.on('tmux-confirmation-required', callback);
    return () => ipcRenderer.removeListener('tmux-confirmation-required', callback);
  },
  
  onTmuxSessionEnded: (callback) => {
    ipcRenderer.on('tmux-session-ended', callback);
    return () => ipcRenderer.removeListener('tmux-session-ended', callback);
  },
  
  onTmuxSessionError: (callback) => {
    ipcRenderer.on('tmux-session-error', callback);
    return () => ipcRenderer.removeListener('tmux-session-error', callback);
  },
  
  onTmuxCommandSent: (callback) => {
    ipcRenderer.on('tmux-command-sent', callback);
    return () => ipcRenderer.removeListener('tmux-command-sent', callback);
  },
  
  onTmuxModeChanged: (callback) => {
    ipcRenderer.on('tmux-mode-changed', callback);
    return () => ipcRenderer.removeListener('tmux-mode-changed', callback);
  }
};

console.log('Preload script loaded successfully');
console.log('electronAPI exposed:', !!window.electronAPI);

// Test the API availability immediately
setTimeout(() => {
  console.log('=== PRELOAD DEBUG ===');
  console.log('window.electronAPI:', window.electronAPI);
  console.log('openDirectoryDialog available:', !!window.electronAPI?.openDirectoryDialog);
  if (window.electronAPI) {
    console.log('Available methods:', Object.keys(window.electronAPI));
  }
}, 1000);

// Global types for TypeScript  
window.electronAPI = window.electronAPI;
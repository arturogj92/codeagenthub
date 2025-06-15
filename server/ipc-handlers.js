import { ipcMain, dialog } from 'electron';
import { getDatabase } from './db/database.js';
import WorktreeManager from './git/worktree-manager.js';
import JobRunner from './agents/job-runner.js';
import { Session, Job, Message, JobDetails, JobConfirmation, JobStatus, AgentType } from './db/models.js';
import { v4 as uuidv4 } from 'uuid';
import { getMainWindow, showNotification } from '../electron/main.js';
import { claudeInteractiveClient } from './claude-interactive-client.js';
import { tmuxManager } from './tmux-manager.js';

let db;
let worktreeManager;

function setupIpcHandlers() {
  db = getDatabase();
  worktreeManager = new WorktreeManager(process.cwd());

  // Session operations
  ipcMain.handle('get-sessions', async () => {
    try {
      const stmt = db.prepare(
        'SELECT id, project, agent, branch, worktree, started_at FROM sessions ORDER BY started_at DESC'
      );
      const rows = stmt.all();
      return rows.map(row => Session.fromDb(row));
    } catch (error) {
      console.error('Failed to get sessions:', error);
      throw error;
    }
  });

  ipcMain.handle('create-session', async (event, project, agent) => {
    try {
      console.log('=== CREATE SESSION IPC HANDLER ===');
      console.log('Project:', project);
      console.log('Agent:', agent);
      
      const sessionId = uuidv4();
      console.log('Generated session ID:', sessionId);
      
      console.log('Creating worktree manager for project:', project);
      const projectWorktreeManager = new WorktreeManager(project);
      
      const { branch, worktreePath } = await projectWorktreeManager.createWorktree(sessionId);
      
      console.log('Worktree created successfully');
      console.log('Branch:', branch);
      console.log('Worktree path:', worktreePath);
      
      const stmt = db.prepare(
        'INSERT INTO sessions (project, agent, branch, worktree) VALUES (?, ?, ?, ?)'
      );
      const result = stmt.run(project, agent, branch, worktreePath);
      
      console.log('Session saved to database with ID:', result.lastInsertRowid);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  });

  // Job operations
  ipcMain.handle('get-jobs', async () => {
    try {
      const stmt = db.prepare(`
        SELECT id, session_id, prompt, status, cost_cents, latency_ms, experiment_id, created_at, ended_at 
        FROM jobs ORDER BY created_at DESC
      `);
      const rows = stmt.all();
      return rows.map(row => Job.fromDb(row));
    } catch (error) {
      console.error('Failed to get jobs:', error);
      throw error;
    }
  });

  ipcMain.handle('create-job', async (event, sessionId, prompt, experimentId = null) => {
    try {
      const stmt = db.prepare(
        'INSERT INTO jobs (session_id, prompt, experiment_id) VALUES (?, ?, ?)'
      );
      const result = stmt.run(sessionId, prompt, experimentId);
      
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Failed to create job:', error);
      throw error;
    }
  });

  ipcMain.handle('update-job-status', async (event, jobId, status, costCents = null, latencyMs = null) => {
    try {
      const endedAt = (status === JobStatus.DONE || status === JobStatus.ERROR) 
        ? new Date().toISOString() 
        : null;

      let stmt, params;
      if (costCents !== null && latencyMs !== null && endedAt) {
        stmt = db.prepare(
          'UPDATE jobs SET status = ?, cost_cents = ?, latency_ms = ?, ended_at = ? WHERE id = ?'
        );
        params = [status, costCents, latencyMs, endedAt, jobId];
      } else {
        stmt = db.prepare('UPDATE jobs SET status = ? WHERE id = ?');
        params = [status, jobId];
      }

      stmt.run(...params);

      // Notify frontend about status change
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('job-status-update', { jobId, status, costCents, latencyMs });
      }

      // Show notification for completed jobs
      if (status === JobStatus.DONE) {
        showNotification('Job Completed', `Job #${jobId} completed successfully`);
      } else if (status === JobStatus.ERROR) {
        showNotification('Job Failed', `Job #${jobId} encountered an error`);
      }

    } catch (error) {
      console.error('Failed to update job status:', error);
      throw error;
    }
  });

  ipcMain.handle('execute-job', async (event, jobId) => {
    try {
      console.log('=== IPC HANDLER: execute-job called ===');
      console.log('Job ID:', jobId);
      
      // Get job details from database
      const stmt = db.prepare(`
        SELECT j.session_id, j.prompt, s.agent, s.worktree 
        FROM jobs j 
        JOIN sessions s ON j.session_id = s.id 
        WHERE j.id = ?
      `);
      const jobData = stmt.get(jobId);
      
      console.log('Job data from DB:', jobData);
      
      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      const { prompt, agent, worktree } = jobData;
      
      console.log('About to update job status to RUNNING');
      
      // Update job status to RUNNING
      await ipcMain.emit('update-job-status', event, jobId, JobStatus.RUNNING);
      
      console.log('Creating JobRunner with:', { jobId, agent, worktree, prompt });
      
      // Execute job in background
      const runner = new JobRunner(jobId, agent, worktree, prompt || '');
      
      console.log('Starting job execution in background');
      
      // Don't await - run in background
      runner.execute().then(result => {
        console.log('Job execution completed:', result);
        const status = result.success ? JobStatus.DONE : JobStatus.ERROR;
        ipcMain.emit('update-job-status', event, jobId, status, result.cost_cents, result.duration_ms);
      }).catch(error => {
        console.error(`Job ${jobId} execution failed:`, error);
        ipcMain.emit('update-job-status', event, jobId, JobStatus.ERROR);
      });

      console.log('execute-job handler completed successfully');
      return { success: true };

    } catch (error) {
      console.error('Failed to execute job:', error);
      throw error;
    }
  });

  // Message and details operations
  ipcMain.handle('get-job-messages', async (event, jobId) => {
    try {
      const stmt = db.prepare(
        'SELECT id, job_id, role, content, ts FROM messages WHERE job_id = ? ORDER BY ts ASC'
      );
      const rows = stmt.all(jobId);
      return rows.map(row => Message.fromDb(row));
    } catch (error) {
      console.error('Failed to get job messages:', error);
      throw error;
    }
  });

  ipcMain.handle('get-job-details', async (event, jobId) => {
    try {
      // Get job info with session details
      const stmt = db.prepare(`
        SELECT j.id, j.session_id, j.prompt, j.status, j.cost_cents, j.latency_ms, 
               j.experiment_id, j.created_at, j.ended_at,
               s.project, s.agent, s.branch, s.worktree
        FROM jobs j 
        JOIN sessions s ON j.session_id = s.id 
        WHERE j.id = ?
      `);
      const jobRow = stmt.get(jobId);
      
      if (!jobRow) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Get messages
      const messagesStmt = db.prepare(
        'SELECT id, job_id, role, content, ts FROM messages WHERE job_id = ? ORDER BY ts ASC'
      );
      const messageRows = messagesStmt.all(jobId);
      const messages = messageRows.map(row => Message.fromDb(row));

      // Create JobDetails object
      return new JobDetails({
        id: jobRow.id,
        session_id: jobRow.session_id,
        prompt: jobRow.prompt,
        status: jobRow.status,
        cost_cents: jobRow.cost_cents,
        latency_ms: jobRow.latency_ms,
        experiment_id: jobRow.experiment_id,
        created_at: jobRow.created_at,
        ended_at: jobRow.ended_at,
        project: jobRow.project,
        agent: jobRow.agent,
        branch: jobRow.branch,
        worktree: jobRow.worktree,
        messages
      });
    } catch (error) {
      console.error('Failed to get job details:', error);
      throw error;
    }
  });

  // Confirmation operations
  ipcMain.handle('get-pending-confirmations', async (event, jobId) => {
    try {
      const stmt = db.prepare(`
        SELECT id, job_id, message, status, created_at, responded_at 
        FROM job_confirmations 
        WHERE job_id = ? AND status = 'PENDING' 
        ORDER BY created_at ASC
      `);
      const rows = stmt.all(jobId);
      return rows.map(row => JobConfirmation.fromDb(row));
    } catch (error) {
      console.error('Failed to get pending confirmations:', error);
      throw error;
    }
  });

  ipcMain.handle('respond-to-confirmation', async (event, confirmationId, approved) => {
    try {
      const status = approved ? 'APPROVED' : 'DENIED';
      const respondedAt = new Date().toISOString();
      
      const stmt = db.prepare(
        'UPDATE job_confirmations SET status = ?, responded_at = ? WHERE id = ?'
      );
      stmt.run(status, respondedAt, confirmationId);

      // Get job ID to find corresponding Claude session
      const confirmationStmt = db.prepare('SELECT job_id FROM job_confirmations WHERE id = ?');
      const confirmation = confirmationStmt.get(confirmationId);
      
      if (confirmation) {
        // Get Claude session for this job
        const jobStmt = db.prepare('SELECT claude_session_id FROM jobs WHERE id = ?');
        const job = jobStmt.get(confirmation.job_id);
        
        if (job?.claude_session_id) {
          // Send response to Claude interactive session
          await claudeInteractiveClient.respondToConfirmation(job.claude_session_id, approved);
        }
      }

      // Notify frontend about confirmation response
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('job-confirmation-response', { confirmationId, approved });
      }

    } catch (error) {
      console.error('Failed to respond to confirmation:', error);
      throw error;
    }
  });

  // Claude Interactive Mode operations
  ipcMain.handle('get-active-claude-sessions', async () => {
    try {
      const sessions = claudeInteractiveClient.getActiveSessions();
      return sessions;
    } catch (error) {
      console.error('Failed to get active Claude sessions:', error);
      throw error;
    }
  });

  ipcMain.handle('get-claude-session-output', async (event, sessionId, lines = 50) => {
    try {
      const output = await claudeInteractiveClient.getSessionOutput(sessionId, lines);
      return output;
    } catch (error) {
      console.error('Failed to get Claude session output:', error);
      throw error;
    }
  });

  ipcMain.handle('send-prompt-to-claude', async (event, sessionId, prompt) => {
    try {
      await claudeInteractiveClient.sendPrompt(sessionId, prompt);
      return true;
    } catch (error) {
      console.error('Failed to send prompt to Claude:', error);
      throw error;
    }
  });

  ipcMain.handle('get-all-pending-confirmations', async () => {
    try {
      const confirmations = claudeInteractiveClient.getPendingConfirmations();
      return confirmations;
    } catch (error) {
      console.error('Failed to get all pending confirmations:', error);
      throw error;
    }
  });

  ipcMain.handle('terminate-claude-session', async (event, sessionId) => {
    try {
      await claudeInteractiveClient.terminateSession(sessionId);
      return true;
    } catch (error) {
      console.error('Failed to terminate Claude session:', error);
      throw error;
    }
  });

  // Set up Claude Interactive Client event forwarding
  claudeInteractiveClient.on('confirmationRequired', (confirmation) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('claude-confirmation-required', confirmation);
    }
  });

  claudeInteractiveClient.on('sessionCreated', (session) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('claude-session-created', session);
    }
  });

  claudeInteractiveClient.on('sessionEnded', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('claude-session-ended', data);
    }
  });

  // Git operations
  ipcMain.handle('git-pull', async (event, worktreePath) => {
    try {
      return await worktreeManager.gitPull(worktreePath);
    } catch (error) {
      console.error('Git pull failed:', error);
      throw error;
    }
  });

  ipcMain.handle('git-add-all', async (event, worktreePath) => {
    try {
      return await worktreeManager.gitAddAll(worktreePath);
    } catch (error) {
      console.error('Git add failed:', error);
      throw error;
    }
  });

  ipcMain.handle('git-commit', async (event, worktreePath, message) => {
    try {
      return await worktreeManager.gitCommit(worktreePath, message);
    } catch (error) {
      console.error('Git commit failed:', error);
      throw error;
    }
  });

  ipcMain.handle('git-push', async (event, worktreePath, branch) => {
    try {
      return await worktreeManager.gitPush(worktreePath, branch);
    } catch (error) {
      console.error('Git push failed:', error);
      throw error;
    }
  });

  ipcMain.handle('git-diff', async (event, worktreePath) => {
    try {
      return await worktreeManager.gitDiff(worktreePath);
    } catch (error) {
      console.error('Git diff failed:', error);
      throw error;
    }
  });

  ipcMain.handle('git-status', async (event, worktreePath) => {
    try {
      return await worktreeManager.gitStatus(worktreePath);
    } catch (error) {
      console.error('Git status failed:', error);
      throw error;
    }
  });

  // File operations
  ipcMain.handle('list-worktree-files', async (event, worktreePath) => {
    try {
      return await worktreeManager.listWorktreeFiles(worktreePath);
    } catch (error) {
      console.error('Failed to list worktree files:', error);
      throw error;
    }
  });

  ipcMain.handle('open-directory-dialog', async () => {
    console.log('=== IPC: open-directory-dialog called ===');
    try {
      console.log('Opening directory dialog...');
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Directory'
      });
      
      console.log('Dialog result:', result);
      const selectedPath = result.canceled ? null : result.filePaths[0];
      console.log('Returning path:', selectedPath);
      return selectedPath;
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      throw error;
    }
  });

  // === TMUX OPERATIONS ===
  
  // Crear sesión tmux
  ipcMain.handle('tmux-create-session', async (event, options) => {
    try {
      console.log('Creating tmux session with options:', options);
      const sessionId = await tmuxManager.createSession(options);
      return sessionId;
    } catch (error) {
      console.error('Failed to create tmux session:', error);
      throw error;
    }
  });

  // Enviar comando a sesión tmux
  ipcMain.handle('tmux-send-command', async (event, sessionId, command) => {
    try {
      console.log(`Sending command to tmux session ${sessionId}:`, command);
      await tmuxManager.sendCommand(sessionId, command);
      return true;
    } catch (error) {
      console.error('Failed to send command to tmux:', error);
      throw error;
    }
  });

  // Obtener output de sesión tmux
  ipcMain.handle('tmux-get-output', async (event, sessionId, lines = 20) => {
    try {
      const output = await tmuxManager.getOutput(sessionId, lines);
      return output;
    } catch (error) {
      console.error('Failed to get tmux output:', error);
      throw error;
    }
  });

  // Responder confirmación en tmux
  ipcMain.handle('tmux-respond-confirmation', async (event, sessionId, confirm) => {
    try {
      console.log(`Responding to confirmation in session ${sessionId}:`, confirm);
      await tmuxManager.respondConfirmation(sessionId, confirm);
      return true;
    } catch (error) {
      console.error('Failed to respond to tmux confirmation:', error);
      throw error;
    }
  });

  // Terminar sesión tmux
  ipcMain.handle('tmux-terminate-session', async (event, sessionId) => {
    try {
      console.log('Terminating tmux session:', sessionId);
      await tmuxManager.terminateSession(sessionId);
      return true;
    } catch (error) {
      console.error('Failed to terminate tmux session:', error);
      throw error;
    }
  });

  // Listar sesiones tmux activas
  ipcMain.handle('tmux-list-sessions', async () => {
    try {
      const sessions = Array.from(tmuxManager.activeSessions.values());
      return sessions;
    } catch (error) {
      console.error('Failed to list tmux sessions:', error);
      throw error;
    }
  });

  // Cambiar modo de Claude con Shift+Tab
  ipcMain.handle('tmux-cycle-modes', async (event, sessionId) => {
    try {
      console.log('Cycling Claude modes for session:', sessionId);
      console.log('Active sessions in TmuxManager:', Array.from(tmuxManager.activeSessions.keys()));
      await tmuxManager.cycleModes(sessionId);
      return true;
    } catch (error) {
      console.error('Failed to cycle Claude modes:', error);
      throw error;
    }
  });

  // Set up tmux event forwarding
  tmuxManager.on('confirmationRequired', (data) => {
    console.log('Tmux confirmation required:', data);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('tmux-confirmation-required', data);
    }
  });

  tmuxManager.on('sessionEnded', (data) => {
    console.log('Tmux session ended:', data);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('tmux-session-ended', data);
    }
  });

  tmuxManager.on('sessionError', (data) => {
    console.log('Tmux session error:', data);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('tmux-session-error', data);
    }
  });

  tmuxManager.on('commandSent', (data) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('tmux-command-sent', data);
    }
  });

  tmuxManager.on('modeChanged', (data) => {
    console.log('Tmux mode changed:', data);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('tmux-mode-changed', data);
    }
  });

  console.log('IPC handlers registered successfully');
}

export { setupIpcHandlers };
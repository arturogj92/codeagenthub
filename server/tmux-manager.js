import { exec } from 'child_process';
import { EventEmitter } from 'events';

export class TmuxManager extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.isSetupComplete = false;
  }

  async ensureSetup() {
    if (this.isSetupComplete) return;

    console.log('Checking tmux installation...');
    
    // Check if tmux is installed
    if (!(await this._isTmuxInstalled())) {
      console.log('tmux not found, checking Homebrew...');
      
      // Check if Homebrew is installed
      if (!(await this._isBrewInstalled())) {
        console.log('Installing Homebrew...');
        await this._installHomebrew();
      }
      
      console.log('Installing tmux...');
      await this._installTmux();
    }
    
    this.isSetupComplete = true;
    console.log('tmux setup complete');
  }

  async createSession({ sessionId, workingDirectory, claudeSessionId }) {
    await this.ensureSetup();
    
    const tmuxSessionName = `codeagent-${sessionId}`;
    
    let claudeCommand = 'claude';
    if (claudeSessionId) {
      claudeCommand += ` --resume ${claudeSessionId}`;
    }

    await this._execCommand(`tmux new-session -d -s "${tmuxSessionName}" -c "${workingDirectory}"`);
    
    // Esperar un momento antes de iniciar Claude - reducido para mayor velocidad
    await new Promise(resolve => setTimeout(resolve, 500)); // Reducido de 1000 a 500ms
    
    await this._execCommand(`tmux send-keys -t "${tmuxSessionName}" "${claudeCommand}" Enter`);

    const sessionInfo = {
      sessionId,
      tmuxSessionName,
      workingDirectory,
      claudeSessionId,
      isActive: true,
      createdAt: new Date()
    };

    this.activeSessions.set(sessionId, sessionInfo);
    this._startMonitoring(sessionInfo);
    
    return sessionId;
  }

  async sendCommand(sessionId, command) {
    let session = this.activeSessions.get(sessionId);
    
    // Si no encontramos por sessionId, buscar por tmuxSessionName
    if (!session) {
      for (const [key, sess] of this.activeSessions.entries()) {
        if (sess.tmuxSessionName === `codeagent-${sessionId}` || sess.tmuxSessionName === sessionId) {
          session = sess;
          sessionId = key;
          break;
        }
      }
    }
    
    if (!session?.isActive) {
      throw new Error(`Session ${sessionId} not active`);
    }

    console.log(`Sending to tmux session ${session.tmuxSessionName}: "${command}"`);
    
    // Clear any existing text first with Ctrl+U
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" C-u`);
    await new Promise(resolve => setTimeout(resolve, 25)); // Ultra rápido - 25ms
    
    // Send the actual command (without Enter initially)
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" "${command.replace(/"/g, '\\"')}"`);
    
    // Wait for the text to appear, then send Enter
    await new Promise(resolve => setTimeout(resolve, 100)); // Ultra rápido - 100ms
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" Enter`);
    
    // Wait a bit more and send another Enter to trigger processing
    await new Promise(resolve => setTimeout(resolve, 100)); // Ultra rápido - 100ms
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" "" Enter`);
    
    this.emit('commandSent', { sessionId, command });
  }

  // Enviar Shift+Tab para cambiar modo de Claude
  async cycleModes(sessionId) {
    let session = this.activeSessions.get(sessionId);
    
    // Si no encontramos por sessionId, buscar por tmuxSessionName
    if (!session) {
      console.log(`Session ${sessionId} not found, searching by tmuxSessionName...`);
      for (const [key, sess] of this.activeSessions.entries()) {
        if (sess.tmuxSessionName === `codeagent-${sessionId}` || sess.tmuxSessionName === sessionId) {
          session = sess;
          sessionId = key; // Actualizar sessionId al correcto
          console.log(`Found session by tmuxSessionName: ${sess.tmuxSessionName}`);
          break;
        }
      }
    }
    
    if (!session?.isActive) {
      console.log(`Available sessions:`, Array.from(this.activeSessions.keys()));
      throw new Error(`Session ${sessionId} not active`);
    }

    console.log(`Cycling Claude modes for session ${session.tmuxSessionName}`);
    
    // First, make sure we're at a clean prompt
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" C-c`); // Cancel any current input
    await new Promise(resolve => setTimeout(resolve, 100));
    await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" C-u`); // Clear line
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`Executing: tmux send-keys -t "${session.tmuxSessionName}" BTab`);
    
    // Now send Shift+Tab (BTab) to cycle between modes
    const result = await this._execCommand(`tmux send-keys -t "${session.tmuxSessionName}" BTab`);
    console.log(`Shift+Tab (BTab) command result:`, result);
    
    this.emit('modeChanged', { sessionId });
  }

  async getOutput(sessionId, lines = 20) {
    let session = this.activeSessions.get(sessionId);
    
    // Si no encontramos por sessionId, buscar por tmuxSessionName
    if (!session) {
      for (const [key, sess] of this.activeSessions.entries()) {
        if (sess.tmuxSessionName === `codeagent-${sessionId}` || sess.tmuxSessionName === sessionId) {
          session = sess;
          sessionId = key;
          break;
        }
      }
    }
    
    if (!session?.isActive) {
      throw new Error(`Session ${sessionId} not active`);
    }

    const output = await this._execCommand(`tmux capture-pane -t "${session.tmuxSessionName}" -p -S -${lines}`);
    return output.trim();
  }

  async respondConfirmation(sessionId, confirm) {
    await this.sendCommand(sessionId, confirm ? 'y' : 'n');
    this.emit('confirmationResponded', { sessionId, confirmed: confirm });
  }

  async terminateSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      await this._execCommand(`tmux kill-session -t "${session.tmuxSessionName}"`);
      this.activeSessions.delete(sessionId);
      this.emit('sessionTerminated', { sessionId });
    }
  }

  _startMonitoring(sessionInfo) {
    const interval = setInterval(async () => {
      try {
        if (!sessionInfo.isActive) {
          clearInterval(interval);
          return;
        }

        const output = await this.getOutput(sessionInfo.sessionId, 5);
        
        if (this._hasConfirmation(output)) {
          this.emit('confirmationRequired', {
            sessionId: sessionInfo.sessionId,
            output,
            timestamp: new Date()
          });
        }

        // Check if session is still alive
        const isAlive = await this._isSessionAlive(sessionInfo.tmuxSessionName);
        if (!isAlive) {
          sessionInfo.isActive = false;
          clearInterval(interval);
          this.activeSessions.delete(sessionInfo.sessionId);
          this.emit('sessionEnded', { sessionId: sessionInfo.sessionId });
        }
      } catch (error) {
        clearInterval(interval);
        sessionInfo.isActive = false;
        this.activeSessions.delete(sessionInfo.sessionId);
        this.emit('sessionError', { sessionId: sessionInfo.sessionId, error: error.message });
      }
    }, 500); // Monitorear cada 500ms para detección rápida de confirmaciones

    sessionInfo.monitorInterval = interval;
  }

  _hasConfirmation(output) {
    const patterns = [
      /Do you want to make this edit/i,
      /Continue with this edit/i,
      /Apply this change/i,
      /\[y\/n\]/i,
      /\(y\/n\)/i
    ];
    return patterns.some(pattern => pattern.test(output));
  }

  async _isSessionAlive(tmuxSessionName) {
    try {
      await this._execCommand(`tmux has-session -t "${tmuxSessionName}"`);
      return true;
    } catch {
      return false;
    }
  }

  async _isTmuxInstalled() {
    try {
      await this._execCommand('tmux -V');
      return true;
    } catch {
      return false;
    }
  }

  async _isBrewInstalled() {
    try {
      await this._execCommand('brew --version');
      return true;
    } catch {
      return false;
    }
  }

  async _installHomebrew() {
    const installScript = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
    await this._execCommand(installScript);
  }

  async _installTmux() {
    await this._execCommand('brew install tmux');
  }

  _execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async cleanup() {
    const sessions = Array.from(this.activeSessions.values());
    
    for (const session of sessions) {
      try {
        if (session.monitorInterval) {
          clearInterval(session.monitorInterval);
        }
        await this.terminateSession(session.sessionId);
      } catch (error) {
        console.error(`Error cleaning up session ${session.sessionId}:`, error);
      }
    }
    
    this.activeSessions.clear();
    this.emit('cleanupComplete');
  }
}

export const tmuxManager = new TmuxManager();
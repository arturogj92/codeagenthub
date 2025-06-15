import { query } from '@anthropic-ai/claude-code';
import { spawn } from 'child_process';
import path from 'path';
import { AgentType } from '../db/models.js';
import { getDatabase } from '../db/database.js';
import { claudeInteractiveClient } from '../claude-interactive-client.js';

class JobRunner {
  constructor(jobId, agent, worktreePath, prompt) {
    this.jobId = jobId;
    this.agent = agent;
    this.worktreePath = worktreePath;
    this.prompt = prompt;
    this.db = getDatabase();
    this.isExecuting = false;
    this.abortController = new AbortController();
  }

  saveMessage(role, content) {
    try {
      const timestamp = new Date().toISOString();
      const stmt = this.db.prepare(
        'INSERT INTO messages (job_id, role, content, ts) VALUES (?, ?, ?, ?)'
      );
      stmt.run(this.jobId, role, content, timestamp);
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  saveConfirmation(message) {
    try {
      const timestamp = new Date().toISOString();
      const stmt = this.db.prepare(
        'INSERT INTO job_confirmations (job_id, message, status, created_at) VALUES (?, ?, ?, ?)'
      );
      stmt.run(this.jobId, message, 'PENDING', timestamp);
    } catch (error) {
      console.error('Failed to save confirmation:', error);
    }
  }

  async execute() {
    const startTime = Date.now();
    this.isExecuting = true;

    try {
      // Save initial session info
      this.saveMessage('system', `🎯 Iniciando Job #${this.jobId}`);
      this.saveMessage('system', `🕐 Hora de inicio: ${new Date().toISOString()}`);
      this.saveMessage('system', `⚙️ Agente: ${this.agent}`);
      
      // Save initial user prompt
      this.saveMessage('user', this.prompt);

      let result;
      switch (this.agent) {
        case AgentType.CLAUDE_SUB:
          result = await this.runClaudeSDK();
          break;
        case AgentType.CLAUDE_API:
          result = await this.runClaudeAPI();
          break;
        case AgentType.CODEX_CLI:
          result = await this.runCodexCli();
          break;
        default:
          throw new Error(`Unknown agent type: ${this.agent}`);
      }

      const duration = Date.now() - startTime;
      
      // Save successful output
      this.saveMessage('assistant', result.output);
      
      return {
        success: true,
        output: result.output,
        error: null,
        duration_ms: duration,
        cost_cents: result.cost_cents || 0.0
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Save error message
      this.saveMessage('system', `Error: ${error.message}`);
      
      return {
        success: false,
        output: '',
        error: error.message,
        duration_ms: duration,
        cost_cents: 0.0
      };
    } finally {
      this.isExecuting = false;
    }
  }

  async runClaudeSDK() {
    this.saveMessage('system', '🔍 Iniciando Claude Code en modo interactivo...');
    this.saveMessage('system', `📂 Directorio de trabajo: ${this.worktreePath}`);

    try {
      // Check if this job has an existing Claude session to resume
      const existingSession = this.getExistingClaudeSession();
      
      // Create interactive session
      const sessionId = await claudeInteractiveClient.createSession({
        workingDirectory: this.worktreePath,
        claudeSessionId: existingSession?.claude_session_id,
        jobId: this.jobId
      });

      this.saveMessage('system', `🚀 Sesión interactiva creada: ${sessionId}`);

      // Store session ID for future resumption
      this.updateJobClaudeSession(sessionId);

      // Set up event listeners for this job
      const confirmationHandler = (confirmation) => {
        if (confirmation.jobId === this.jobId) {
          this.saveMessage('system', '🤔 Claude solicita confirmación');
          this.saveConfirmation(confirmation.output);
        }
      };

      const sessionEndHandler = (data) => {
        if (data.sessionId === sessionId) {
          this.saveMessage('system', '✅ Sesión Claude finalizada');
        }
      };

      claudeInteractiveClient.on('confirmationRequired', confirmationHandler);
      claudeInteractiveClient.on('sessionEnded', sessionEndHandler);

      try {
        // Send the initial prompt
        await claudeInteractiveClient.sendPrompt(sessionId, this.prompt);
        this.saveMessage('system', '📤 Prompt enviado a Claude');

        // Monitor session output for completion
        let totalOutput = '';
        const maxWaitTime = 10 * 60 * 1000; // 10 minutes
        const pollInterval = 3000; // 3 seconds
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
          // Check if job was aborted
          if (this.abortController.signal.aborted) {
            this.saveMessage('system', '⚠️ Ejecución cancelada');
            break;
          }

          // Get current output
          const currentOutput = await claudeInteractiveClient.getSessionOutput(sessionId, 50);
          
          if (currentOutput !== totalOutput) {
            const newContent = currentOutput.substring(totalOutput.length);
            if (newContent.trim()) {
              this.saveMessage('assistant', newContent.trim());
              totalOutput = currentOutput;
            }
          }

          // Check for completion indicators
          if (this.isTaskComplete(currentOutput)) {
            this.saveMessage('system', '✅ Tarea completada detectada');
            break;
          }

          // Check for pending confirmations that need user input
          const pendingConfirmation = claudeInteractiveClient.getPendingConfirmation(sessionId);
          if (pendingConfirmation) {
            this.saveMessage('system', '⏸️ Esperando confirmación del usuario...');
            // In a real implementation, this would wait for user response
            // For now, we'll auto-confirm after a timeout
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Auto-confirm for demo (in production, this would be user-driven)
            await claudeInteractiveClient.respondToConfirmation(sessionId, true);
            this.saveMessage('system', '✅ Confirmación automática enviada');
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waitTime += pollInterval;
        }

        if (waitTime >= maxWaitTime) {
          this.saveMessage('system', '⏰ Timeout alcanzado');
        }

        // Check what files were created/modified
        await this.checkWorktreeFiles();

        // Keep session alive for potential resumption
        this.saveMessage('system', '💾 Sesión mantenida para futura reanudación');

        return {
          output: totalOutput.trim() || 'Task completed in interactive mode',
          cost_cents: 0 // Interactive mode cost tracking TBD
        };

      } finally {
        // Clean up event listeners
        claudeInteractiveClient.off('confirmationRequired', confirmationHandler);
        claudeInteractiveClient.off('sessionEnded', sessionEndHandler);
      }

    } catch (error) {
      this.saveMessage('system', `❌ Error en modo interactivo: ${error.message}`);
      throw error;
    }
  }

  getExistingClaudeSession() {
    try {
      const stmt = this.db.prepare('SELECT claude_session_id FROM jobs WHERE id = ?');
      return stmt.get(this.jobId);
    } catch (error) {
      return null;
    }
  }

  updateJobClaudeSession(sessionId) {
    try {
      const stmt = this.db.prepare('UPDATE jobs SET claude_session_id = ? WHERE id = ?');
      stmt.run(sessionId, this.jobId);
    } catch (error) {
      console.error('Failed to update Claude session ID:', error);
    }
  }

  isTaskComplete(output) {
    const completionPatterns = [
      /task completed/i,
      /✅/,
      /done/i,
      /finished/i,
      /completado/i,
      /finalizado/i
    ];
    return completionPatterns.some(pattern => pattern.test(output));
  }

  containsConfirmationRequest(content) {
    const confirmationPatterns = [
      /\(y\/n\)/i,
      /\(Y\/n\)/i,
      /confirm/i,
      /Continue\?/i,
      /proceed/i,
      /Proceed/i,
      /¿continuar\?/i,
      /continuar/i
    ];
    
    return confirmationPatterns.some(pattern => pattern.test(content));
  }

  async checkWorktreeFiles() {
    try {
      this.saveMessage('system', '🔍 Verificando archivos en el directorio...');
      
      const { promises: fs } = await import('fs');
      const entries = await fs.readdir(this.worktreePath, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        if (!entry.name.startsWith('.')) {
          const fileType = entry.isDirectory() ? '📁' : '📄';
          files.push(`${fileType} ${entry.name}`);
        }
      }
      
      if (files.length === 0) {
        this.saveMessage('system', '📂 No se crearon archivos nuevos');
      } else {
        files.sort();
        this.saveMessage('system', '📂 Archivos en el directorio:');
        for (const file of files) {
          this.saveMessage('system', `   ${file}`);
        }
      }
    } catch (error) {
      this.saveMessage('system', `❌ Error verificando directorio: ${error.message}`);
    }
  }

  async runClaudeAPI() {
    // TODO: Implement Claude API integration
    throw new Error('Claude API integration not implemented yet');
  }

  async runCodexCli() {
    this.saveMessage('system', '🔍 Verificando disponibilidad de Codex CLI...');
    
    return new Promise((resolve, reject) => {
      const codex = spawn('codex', [
        '--prompt', this.prompt,
        '--directory', this.worktreePath
      ], {
        cwd: this.worktreePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      codex.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Save real-time output
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.trim()) {
            this.saveMessage('assistant', line);
          }
        }
      });

      codex.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        this.saveMessage('system', `⚠️ Codex: ${error}`);
      });

      codex.on('close', (code) => {
        if (code === 0) {
          this.saveMessage('system', '✅ Codex CLI completado exitosamente');
          resolve({
            output: stdout || 'Codex task completed',
            cost_cents: 0 // Codex CLI doesn't provide cost info
          });
        } else {
          this.saveMessage('system', `❌ Codex CLI terminó con código: ${code}`);
          reject(new Error(`Codex CLI failed with exit code ${code}: ${stderr}`));
        }
      });

      codex.on('error', (error) => {
        this.saveMessage('system', `❌ Error ejecutando Codex CLI: ${error.message}`);
        reject(error);
      });
    });
  }

  abort() {
    if (this.isExecuting) {
      this.abortController.abort();
      this.saveMessage('system', '⚠️ Ejecución cancelada por el usuario');
    }
  }
}

export default JobRunner;
import { EventEmitter } from 'events';
import { tmuxManager } from './tmux-manager.js';

/**
 * ClaudeInteractiveClient - Capa de abstracción para interactuar con Claude Code
 * en modo interactivo usando tmux para sesiones persistentes
 */
export class ClaudeInteractiveClient extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // sessionId -> sessionData
    this.pendingConfirmations = new Map(); // sessionId -> confirmationData
    
    // Forward events from tmux manager
    tmuxManager.on('confirmationRequired', (data) => {
      this._handleConfirmationRequired(data);
    });
    
    tmuxManager.on('sessionEnded', (data) => {
      this.sessions.delete(data.sessionId);
      this.emit('sessionEnded', data);
    });
    
    tmuxManager.on('sessionError', (data) => {
      this.emit('sessionError', data);
    });
  }

  /**
   * Crea una nueva sesión interactiva de Claude
   * @param {Object} options - Configuración de la sesión
   * @param {string} options.workingDirectory - Directorio de trabajo
   * @param {string} options.claudeSessionId - ID de sesión de Claude para reanudar (opcional)
   * @param {number} options.jobId - ID del job asociado
   * @returns {Promise<string>} - ID de la sesión creada
   */
  async createSession({ workingDirectory, claudeSessionId, jobId }) {
    const sessionId = await tmuxManager.createSession({
      workingDirectory,
      claudeSessionId
    });

    const sessionData = {
      sessionId,
      workingDirectory,
      claudeSessionId,
      jobId,
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, sessionData);
    
    this.emit('sessionCreated', sessionData);
    
    return sessionId;
  }

  /**
   * Envía un prompt/comando a una sesión de Claude
   * @param {string} sessionId - ID de la sesión
   * @param {string} prompt - Prompt a enviar
   * @returns {Promise<void>}
   */
  async sendPrompt(sessionId, prompt) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await tmuxManager.sendCommand(sessionId, prompt);
    
    session.lastActivity = new Date();
    
    this.emit('promptSent', {
      sessionId,
      prompt,
      timestamp: new Date()
    });
  }

  /**
   * Obtiene la salida actual de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {number} lines - Número de líneas a obtener
   * @returns {Promise<string>} - Salida de la sesión
   */
  async getSessionOutput(sessionId, lines = 50) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return await tmuxManager.getOutput(sessionId, lines);
  }

  /**
   * Responde a una confirmación pendiente
   * @param {string} sessionId - ID de la sesión
   * @param {boolean} confirmed - true para confirmar, false para rechazar
   * @returns {Promise<void>}
   */
  async respondToConfirmation(sessionId, confirmed) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const confirmation = this.pendingConfirmations.get(sessionId);
    if (!confirmation) {
      throw new Error(`No pending confirmation for session ${sessionId}`);
    }

    await tmuxManager.respondConfirmation(sessionId, confirmed);
    
    // Remove pending confirmation
    this.pendingConfirmations.delete(sessionId);
    
    session.lastActivity = new Date();
    
    this.emit('confirmationResolved', {
      sessionId,
      confirmed,
      timestamp: new Date()
    });
  }

  /**
   * Obtiene todas las confirmaciones pendientes
   * @returns {Array} - Lista de confirmaciones pendientes
   */
  getPendingConfirmations() {
    return Array.from(this.pendingConfirmations.values());
  }

  /**
   * Obtiene una confirmación específica
   * @param {string} sessionId - ID de la sesión
   * @returns {Object|null} - Datos de la confirmación o null si no existe
   */
  getPendingConfirmation(sessionId) {
    return this.pendingConfirmations.get(sessionId) || null;
  }

  /**
   * Termina una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<void>}
   */
  async terminateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await tmuxManager.terminateSession(sessionId);
    
    // Clean up pending confirmations
    this.pendingConfirmations.delete(sessionId);
    this.sessions.delete(sessionId);
    
    this.emit('sessionTerminated', { sessionId });
  }

  /**
   * Obtiene información de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Object|null} - Datos de la sesión o null si no existe
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Obtiene todas las sesiones activas
   * @returns {Array} - Lista de sesiones activas
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  /**
   * Maneja las confirmaciones requeridas por Claude
   * @private
   */
  _handleConfirmationRequired({ sessionId, output, timestamp }) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Confirmation required for unknown session: ${sessionId}`);
      return;
    }

    const confirmationData = {
      sessionId,
      jobId: session.jobId,
      output,
      timestamp,
      status: 'pending'
    };

    this.pendingConfirmations.set(sessionId, confirmationData);
    
    this.emit('confirmationRequired', confirmationData);
  }

  /**
   * Limpia todas las sesiones y recursos
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Terminate all active sessions
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      try {
        await this.terminateSession(sessionId);
      } catch (error) {
        console.error(`Error terminating session ${sessionId}:`, error);
      }
    }
    
    // Clean up tmux manager
    await tmuxManager.cleanup();
    
    this.sessions.clear();
    this.pendingConfirmations.clear();
    
    this.emit('cleanupComplete');
  }
}

// Singleton instance
export const claudeInteractiveClient = new ClaudeInteractiveClient();
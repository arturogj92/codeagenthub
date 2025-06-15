// Job Status enumeration
const JobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING', 
  DONE: 'DONE',
  ERROR: 'ERROR'
};

// Confirmation Status enumeration
const ConfirmationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  TIMEOUT: 'TIMEOUT'
};

// Agent Type enumeration
const AgentType = {
  CLAUDE_SUB: 'claude_sub',
  CLAUDE_API: 'claude_api',
  CODEX_CLI: 'codex_cli'
};

// Utility functions for date handling
function parseDate(dateString) {
  return dateString ? new Date(dateString) : null;
}

function formatDate(date) {
  return date ? date.toISOString() : null;
}

// Session model
class Session {
  constructor(data = {}) {
    this.id = data.id || null;
    this.project = data.project || '';
    this.agent = data.agent || '';
    this.branch = data.branch || '';
    this.worktree = data.worktree || '';
    this.started_at = parseDate(data.started_at);
  }

  static fromDb(row) {
    return new Session({
      id: row.id,
      project: row.project,
      agent: row.agent,
      branch: row.branch,
      worktree: row.worktree,
      started_at: row.started_at
    });
  }

  toDb() {
    return {
      project: this.project,
      agent: this.agent,
      branch: this.branch,
      worktree: this.worktree,
      started_at: formatDate(this.started_at)
    };
  }
}

// Job model
class Job {
  constructor(data = {}) {
    this.id = data.id || null;
    this.session_id = data.session_id || 0;
    this.prompt = data.prompt || null;
    this.status = data.status || JobStatus.QUEUED;
    this.cost_cents = data.cost_cents || 0.0;
    this.latency_ms = data.latency_ms || 0;
    this.experiment_id = data.experiment_id || null;
    this.created_at = parseDate(data.created_at);
    this.ended_at = parseDate(data.ended_at);
  }

  static fromDb(row) {
    return new Job({
      id: row.id,
      session_id: row.session_id,
      prompt: row.prompt,
      status: row.status,
      cost_cents: row.cost_cents,
      latency_ms: row.latency_ms,
      experiment_id: row.experiment_id,
      created_at: row.created_at,
      ended_at: row.ended_at
    });
  }

  toDb() {
    return {
      session_id: this.session_id,
      prompt: this.prompt,
      status: this.status,
      cost_cents: this.cost_cents,
      latency_ms: this.latency_ms,
      experiment_id: this.experiment_id,
      created_at: formatDate(this.created_at),
      ended_at: formatDate(this.ended_at)
    };
  }
}

// Message model
class Message {
  constructor(data = {}) {
    this.id = data.id || null;
    this.job_id = data.job_id || 0;
    this.role = data.role || null;
    this.content = data.content || null;
    this.ts = parseDate(data.ts);
  }

  static fromDb(row) {
    return new Message({
      id: row.id,
      job_id: row.job_id,
      role: row.role,
      content: row.content,
      ts: row.ts
    });
  }

  toDb() {
    return {
      job_id: this.job_id,
      role: this.role,
      content: this.content,
      ts: formatDate(this.ts)
    };
  }
}

// JobConfirmation model
class JobConfirmation {
  constructor(data = {}) {
    this.id = data.id || null;
    this.job_id = data.job_id || 0;
    this.message = data.message || '';
    this.status = data.status || ConfirmationStatus.PENDING;
    this.created_at = parseDate(data.created_at);
    this.responded_at = parseDate(data.responded_at);
  }

  static fromDb(row) {
    return new JobConfirmation({
      id: row.id,
      job_id: row.job_id,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
      responded_at: row.responded_at
    });
  }

  toDb() {
    return {
      job_id: this.job_id,
      message: this.message,
      status: this.status,
      created_at: formatDate(this.created_at),
      responded_at: formatDate(this.responded_at)
    };
  }
}

// JobDetails model (combines Job with additional session info and messages)
class JobDetails {
  constructor(data = {}) {
    this.id = data.id || null;
    this.session_id = data.session_id || 0;
    this.prompt = data.prompt || null;
    this.status = data.status || JobStatus.QUEUED;
    this.cost_cents = data.cost_cents || 0.0;
    this.latency_ms = data.latency_ms || 0;
    this.experiment_id = data.experiment_id || null;
    this.created_at = parseDate(data.created_at);
    this.ended_at = parseDate(data.ended_at);
    this.project = data.project || '';
    this.agent = data.agent || '';
    this.branch = data.branch || '';
    this.worktree = data.worktree || '';
    this.messages = data.messages || [];
  }
}

// Experiment model
class Experiment {
  constructor(data = {}) {
    this.id = data.id || null;
    this.label = data.label || null;
    this.created_at = parseDate(data.created_at);
  }

  static fromDb(row) {
    return new Experiment({
      id: row.id,
      label: row.label,
      created_at: row.created_at
    });
  }

  toDb() {
    return {
      label: this.label,
      created_at: formatDate(this.created_at)
    };
  }
}

// Credential model
class Credential {
  constructor(data = {}) {
    this.id = data.id || null;
    this.provider = data.provider || null;
    this.encrypted = data.encrypted || null;
  }

  static fromDb(row) {
    return new Credential({
      id: row.id,
      provider: row.provider,
      encrypted: row.encrypted
    });
  }

  toDb() {
    return {
      provider: this.provider,
      encrypted: this.encrypted
    };
  }
}

// Setting model
class Setting {
  constructor(data = {}) {
    this.key = data.key || '';
    this.value = data.value || null;
  }

  static fromDb(row) {
    return new Setting({
      key: row.key,
      value: row.value
    });
  }

  toDb() {
    return {
      key: this.key,
      value: this.value
    };
  }
}

export {
  JobStatus,
  ConfirmationStatus,
  AgentType,
  Session,
  Job,
  Message,
  JobConfirmation,
  JobDetails,
  Experiment,
  Credential,
  Setting,
  parseDate,
  formatDate
};
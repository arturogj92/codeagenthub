export interface Session {
  id: number;
  project: string;
  agent: string;
  branch: string;
  worktree: string;
  started_at?: string;
}

export interface Job {
  id: number;
  session_id: number;
  prompt?: string;
  status: JobStatus;
  cost_cents: number;
  latency_ms: number;
  experiment_id?: number;
  created_at?: string;
  ended_at?: string;
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export interface Experiment {
  id: number;
  label?: string;
  created_at?: string;
}

export interface CreateSessionRequest {
  project: string;
  agent: string;
}

export interface CreateJobRequest {
  session_id: number;
  prompt: string;
  experiment_id?: number;
}

export interface Message {
  id: number;
  job_id: number;
  role?: string;
  content?: string;
  ts?: string;
}

export interface JobDetails {
  id: number;
  session_id: number;
  prompt?: string;
  status: JobStatus;
  cost_cents: number;
  latency_ms: number;
  experiment_id?: number;
  created_at?: string;
  ended_at?: string;
  project: string;
  agent: string;
  branch: string;
  worktree: string;
  messages: Message[];
}
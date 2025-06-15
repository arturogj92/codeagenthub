import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db = null;

// Get database path
function getDatabasePath() {
  const homeDir = os.homedir();
  const dbDir = path.join(homeDir, '.codeagent-hub');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'codeagent.db');
}

// Initialize database connection
function initDatabase() {
  if (db) return db;
  
  const dbPath = getDatabasePath();
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log(`Database initialized at: ${dbPath}`);
  return db;
}

// Create all required tables
function createTables() {
  if (!db) throw new Error('Database not initialized');
  
  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      project TEXT NOT NULL,
      agent TEXT NOT NULL,
      branch TEXT NOT NULL,
      worktree TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL,
      prompt TEXT,
      status TEXT DEFAULT 'QUEUED',
      cost_cents REAL DEFAULT 0.0,
      latency_ms INTEGER DEFAULT 0,
      experiment_id INTEGER,
      claude_session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    )
  `);

  // Add claude_session_id column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN claude_session_id TEXT`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Experiments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL,
      role TEXT,
      content TEXT,
      ts DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(job_id) REFERENCES jobs(id)
    )
  `);

  // Job confirmations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_confirmations (
      id INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY(job_id) REFERENCES jobs(id)
    )
  `);

  // Credentials table
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY,
      provider TEXT,
      encrypted BLOB
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  console.log('Database tables created successfully');
}

// Setup database (initialize + create tables)
async function setupDatabase() {
  try {
    initDatabase();
    createTables();
    return db;
  } catch (error) {
    console.error('Failed to setup database:', error);
    throw error;
  }
}

// Get database instance
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call setupDatabase() first.');
  }
  return db;
}

// Close database connection
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

export {
  setupDatabase,
  getDatabase,
  closeDatabase,
  getDatabasePath
};
import React, { useState } from 'react';
import { Session, Job } from '../types';
import { useGitOperations } from '../hooks/useElectron';

interface SessionDetailProps {
  session: Session;
  jobs: Job[];
  onClose: () => void;
}

export function SessionDetail({ session, jobs, onClose }: SessionDetailProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'git' | 'logs'>('jobs');
  const [gitOutput, setGitOutput] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const gitOps = useGitOperations();

  const sessionJobs = jobs.filter(job => job.session_id === session.id);

  const handleGitOperation = async (operation: string) => {
    try {
      let result = '';
      switch (operation) {
        case 'status':
          result = await gitOps.gitStatus(session.worktree);
          break;
        case 'diff':
          result = await gitOps.gitDiff(session.worktree);
          break;
        case 'pull':
          result = await gitOps.gitPull(session.worktree);
          break;
        case 'add':
          result = await gitOps.gitAddAll(session.worktree);
          break;
        case 'push':
          result = await gitOps.gitPush(session.worktree, session.branch);
          break;
      }
      setGitOutput(prev => `$ git ${operation}\n${result}\n\n${prev}`);
    } catch (error) {
      setGitOutput(prev => `$ git ${operation}\nError: ${error}\n\n${prev}`);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      const result = await gitOps.gitCommit(session.worktree, commitMessage);
      setGitOutput(prev => `$ git commit -m "${commitMessage}"\n${result}\n\n${prev}`);
      setCommitMessage('');
    } catch (error) {
      setGitOutput(prev => `$ git commit\nError: ${error}\n\n${prev}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            Session #{session.id} - {session.agent}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 ${activeTab === 'jobs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            Jobs ({sessionJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`px-4 py-2 ${activeTab === 'git' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            Git Operations
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 ${activeTab === 'logs' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
          >
            Logs
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-auto">
          {activeTab === 'jobs' && (
            <div className="space-y-3">
              {sessionJobs.length === 0 ? (
                <p className="text-gray-500">No jobs yet for this session</p>
              ) : (
                sessionJobs.map(job => (
                  <div key={job.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Job #{job.id}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'DONE' ? 'bg-green-100 text-green-800' :
                        job.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    
                    {job.prompt && (
                      <p className="text-sm text-gray-700 mb-2">{job.prompt}</p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {job.created_at && new Date(job.created_at).toLocaleString()}
                      </span>
                      <div className="flex space-x-2">
                        {job.latency_ms > 0 && <span>⏱ {job.latency_ms}ms</span>}
                        {job.cost_cents > 0 && <span>💰 €{(job.cost_cents / 100).toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {activeTab === 'git' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-2">
                <strong>Worktree:</strong> {session.worktree}<br/>
                <strong>Branch:</strong> {session.branch}
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleGitOperation('status')}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Status
                </button>
                <button
                  onClick={() => handleGitOperation('diff')}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Diff
                </button>
                <button
                  onClick={() => handleGitOperation('pull')}
                  className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                >
                  Pull
                </button>
                <button
                  onClick={() => handleGitOperation('add')}
                  className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm"
                >
                  Add All
                </button>
                <button
                  onClick={() => handleGitOperation('push')}
                  className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-sm"
                >
                  Push
                </button>
              </div>
              
              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="flex-1 px-3 py-2 border rounded text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleCommit()}
                />
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Commit
                </button>
              </div>
              
              <div className="bg-black text-green-400 p-3 rounded font-mono text-sm h-64 overflow-auto">
                <pre>{gitOutput || 'Git operations will appear here...'}</pre>
              </div>
            </div>
          )}
          
          {activeTab === 'logs' && (
            <div className="bg-black text-white p-3 rounded font-mono text-sm h-full overflow-auto">
              <pre>Real-time logs for session #{session.id} will appear here...</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
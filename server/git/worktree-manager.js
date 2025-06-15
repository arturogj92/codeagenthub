import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

class WorktreeManager {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.worktreeBase = path.join(this.projectRoot, '.agenthub', '_wt');
    this.git = simpleGit(this.projectRoot);
  }

  async createWorktree(sessionId) {
    try {
      console.log('=== CREATING WORKTREE ===');
      console.log('Project root:', this.projectRoot);
      console.log('Session ID:', sessionId);
      
      // Check if it's a git repository
      const isRepo = await this.isGitRepo();
      console.log('Is git repo:', isRepo);
      
      if (!isRepo) {
        console.log('Initializing git repository...');
        await this.initGitRepo();
      }

      // Check if we have commits after init
      const hasCommits = await this.hasCommits();
      console.log('Has commits:', hasCommits);
      
      if (!hasCommits) {
        throw new Error('Repository has no commits after initialization');
      }

      const branchName = `agent/${sessionId}`;
      const worktreePath = path.join(this.worktreeBase, sessionId);
      
      console.log('Branch name:', branchName);
      console.log('Worktree path:', worktreePath);
      
      // Create worktree base directory
      await fs.mkdir(this.worktreeBase, { recursive: true });

      // Create worktree with new branch
      console.log('Creating worktree...');
      await this.git.raw(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD']);
      
      console.log('Worktree created successfully');
      return { branch: branchName, worktreePath };
    } catch (error) {
      throw new Error(`Failed to create worktree: ${error.message}`);
    }
  }

  async isGitRepo() {
    try {
      await this.git.revparse(['--git-dir']);
      return true;
    } catch (error) {
      return false;
    }
  }

  async initGitRepo() {
    try {
      console.log('Initializing git repository in:', this.projectRoot);
      
      // Initialize git repository
      await this.git.init();
      console.log('Git init completed');
      
      // Check if there are any commits
      const hasCommits = await this.hasCommits();
      console.log('Has commits after init:', hasCommits);
      
      if (!hasCommits) {
        console.log('No commits found, creating initial commit...');
        
        // Create .gitignore if it doesn't exist
        const gitignorePath = path.join(this.projectRoot, '.gitignore');
        try {
          await fs.access(gitignorePath);
          console.log('.gitignore already exists');
        } catch {
          console.log('Creating .gitignore...');
          // .gitignore doesn't exist, create it
          const gitignoreContent = `# CodeAgent Hub
.agenthub/
node_modules/
.DS_Store
*.log
dist/
build/
`;
          await fs.writeFile(gitignorePath, gitignoreContent);
        }

        // Add all files and create initial commit
        console.log('Adding files to git...');
        await this.git.add('.');
        
        console.log('Creating initial commit...');
        await this.git.commit('Initial commit - CodeAgent Hub setup');
        
        console.log('Initial commit created successfully');
      }
    } catch (error) {
      throw new Error(`Failed to initialize git repository: ${error.message}`);
    }
  }

  async hasCommits() {
    try {
      await this.git.revparse(['HEAD']);
      return true;
    } catch (error) {
      return false;
    }
  }

  async removeWorktree(sessionId) {
    try {
      const worktreePath = path.join(this.worktreeBase, sessionId);
      const branchName = `agent/${sessionId}`;

      // Remove worktree
      await this.git.raw(['worktree', 'remove', '--force', worktreePath]);
      
      // Delete branch (ignore errors if branch doesn't exist)
      try {
        await this.git.deleteLocalBranch(branchName, true);
      } catch (error) {
        console.warn(`Could not delete branch ${branchName}:`, error.message);
      }
    } catch (error) {
      throw new Error(`Failed to remove worktree: ${error.message}`);
    }
  }

  async gitPull(worktreePath) {
    try {
      const git = simpleGit(worktreePath);
      const result = await git.pull('origin', { '--ff-only': null });
      return `Pulled changes: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`;
    } catch (error) {
      throw new Error(`Git pull failed: ${error.message}`);
    }
  }

  async gitAddAll(worktreePath) {
    try {
      const git = simpleGit(worktreePath);
      await git.add('.');
      return 'All changes staged successfully';
    } catch (error) {
      throw new Error(`Git add failed: ${error.message}`);
    }
  }

  async gitCommit(worktreePath, message) {
    try {
      const git = simpleGit(worktreePath);
      const result = await git.commit(message);
      return `Commit created: ${result.commit} - ${message}`;
    } catch (error) {
      throw new Error(`Git commit failed: ${error.message}`);
    }
  }

  async gitPush(worktreePath, branch) {
    try {
      const git = simpleGit(worktreePath);
      const result = await git.push('origin', branch);
      return `Pushed to origin/${branch}: ${result.pushed?.length || 0} commits`;
    } catch (error) {
      throw new Error(`Git push failed: ${error.message}`);
    }
  }

  async gitDiff(worktreePath) {
    try {
      const git = simpleGit(worktreePath);
      const diff = await git.diff();
      return diff;
    } catch (error) {
      throw new Error(`Git diff failed: ${error.message}`);
    }
  }

  async gitStatus(worktreePath) {
    try {
      const git = simpleGit(worktreePath);
      const status = await git.status();
      
      let output = '';
      if (status.modified.length > 0) {
        output += `Modified files: ${status.modified.join(', ')}\n`;
      }
      if (status.created.length > 0) {
        output += `New files: ${status.created.join(', ')}\n`;
      }
      if (status.deleted.length > 0) {
        output += `Deleted files: ${status.deleted.join(', ')}\n`;
      }
      if (status.renamed.length > 0) {
        output += `Renamed files: ${status.renamed.map(r => `${r.from} -> ${r.to}`).join(', ')}\n`;
      }
      
      if (output === '') {
        output = 'Working directory clean';
      }
      
      return output;
    } catch (error) {
      throw new Error(`Git status failed: ${error.message}`);
    }
  }

  async listWorktreeFiles(worktreePath) {
    try {
      const entries = await fs.readdir(worktreePath, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        if (!entry.name.startsWith('.')) {
          const fileType = entry.isDirectory() ? 'dir' : 'file';
          files.push(`${entry.name} (${fileType})`);
        }
      }
      
      return files.sort();
    } catch (error) {
      throw new Error(`Failed to list worktree files: ${error.message}`);
    }
  }
}

export default WorktreeManager;
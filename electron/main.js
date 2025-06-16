import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Import server modules
// import { setupDatabase } from '../server/db/database.js'; // Temporarily disabled - better-sqlite3 version issue
import { setupIpcHandlers } from '../server/ipc-handlers.js';
import { tmuxManager } from '../server/tmux-manager.js';

let mainWindow;
let serverProcess;

function createWindow() {
  // Try different preload paths for development vs production
  let preloadPath;
  if (isDev) {
    // In development, the preload script might be in a different location
    preloadPath = path.join(__dirname, 'preload.cjs');
    if (!fs.existsSync(preloadPath)) {
      // Try alternative path for development
      preloadPath = path.resolve(__dirname, 'preload.cjs');
    }
  } else {
    preloadPath = path.join(__dirname, 'preload.cjs');
  }
  
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));
  console.log('__dirname:', __dirname);
  console.log('process.cwd():', process.cwd());
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    movable: true, // Asegurar que la ventana sea movible
    frame: true, // Mostrar la barra de título normal
    webPreferences: {
      nodeIntegration: true, // Always enable for testing
      contextIsolation: false, // Always disable for testing
      preload: preloadPath,
      webSecurity: false, // Always disable for testing
      allowRunningInsecureContent: true,
    },
    show: false,
    icon: path.join(__dirname, '../icons/icon.png')
  });

  // Load the app
  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('app.isPackaged:', app.isPackaged);
  
  // Force production mode to test preload script
  const forceProduction = false; // Set to true to test built version
  
  if (isDev && !forceProduction) {
    console.log('Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Comentado para no abrir DevTools automáticamente
  } else {
    console.log('Loading production file:', path.join(__dirname, '../dist/index.html'));
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show - setting up API injection');
    mainWindow.show();
    mainWindow.focus(); // Force focus
    mainWindow.moveTop(); // Bring to front
    app.focus(); // Focus the app
    
    // Log window state
    console.log('Window visible:', mainWindow.isVisible());
    console.log('Window minimized:', mainWindow.isMinimized());
    console.log('Window maximized:', mainWindow.isMaximized());
    
    // Inject API directly using IPC
    setTimeout(() => {
      console.log('Executing API injection script...');
      mainWindow.webContents.executeJavaScript(`
        console.log('=== API INJECTION SCRIPT RUNNING ===');
        console.log('typeof require:', typeof require);
        console.log('nodeIntegration enabled:', typeof require !== 'undefined');
        
        // Create API that directly calls IPC
        if (!window.electronAPI) {
          console.log('Creating new electronAPI object');
          window.electronAPI = {};
        } else {
          console.log('electronAPI already exists');
        }
        
        // Add the directory dialog function if not already available
        if (!window.electronAPI.openDirectoryDialog) {
          console.log('Adding openDirectoryDialog function');
          window.electronAPI.openDirectoryDialog = async () => {
            console.log('openDirectoryDialog called via injected API');
            
            // Use require to get ipcRenderer in development mode
            if (typeof require !== 'undefined') {
              try {
                const { ipcRenderer } = require('electron');
                console.log('Got ipcRenderer, calling open-directory-dialog');
                return await ipcRenderer.invoke('open-directory-dialog');
              } catch (error) {
                console.error('Direct IPC failed:', error);
                return null;
              }
            } else {
              console.error('require not available - cannot use direct IPC');
              return null;
            }
          };
        } else {
          console.log('openDirectoryDialog already exists');
        }
        
        console.log('=== API INJECTION COMPLETE ===');
        console.log('window.electronAPI:', window.electronAPI);
        console.log('openDirectoryDialog available:', !!window.electronAPI.openDirectoryDialog);
        
        // Test API immediately
        setTimeout(() => {
          console.log('=== 5 SECOND TEST ===');
          console.log('window.electronAPI still available:', !!window.electronAPI);
          console.log('openDirectoryDialog still available:', !!window.electronAPI?.openDirectoryDialog);
        }, 5000);
      `).then(() => {
        console.log('API injection script executed successfully');
      }).catch(error => {
        console.error('API injection script failed:', error);
      });
    }, 2000); // Increased timeout to 2 seconds
  });

  // Handle postMessage from renderer - proper implementation
  mainWindow.webContents.on('did-finish-load', () => {
    // Set up message listener for directory dialog
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('message', async (event) => {
        if (event.data.type === 'open-directory-dialog') {
          console.log('Received directory dialog request');
          // Use the exposed API from preload script if available
          if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
            try {
              const result = await window.electronAPI.openDirectoryDialog();
              window.postMessage({ type: 'directory-dialog-result', result }, '*');
            } catch (error) {
              console.error('Directory dialog failed:', error);
              window.postMessage({ type: 'directory-dialog-result', result: null }, '*');
            }
          } else {
            // Fallback - post message to main process
            window.postMessage({ type: 'directory-dialog-result', result: null }, '*');
          }
        }
      });
    `);
  });

  // Add error handling for renderer process crashes
  mainWindow.webContents.on('crashed', (event) => {
    console.error('Renderer process crashed:', event);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('Renderer process became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('Renderer process became responsive again');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(async () => {
  try {
    // Initialize database
    // await setupDatabase(); // Temporarily disabled - better-sqlite3 version issue
    console.log('Database initialization skipped (compatibility issue)');

    // Initialize tmux manager
    await tmuxManager.ensureSetup();
    console.log('Tmux manager initialized');

    // Setup IPC handlers
    // setupIpcHandlers(); // Temporarily disabled - depends on database
    console.log('IPC handlers setup skipped (database dependency)');

    // Create main window
    createWindow();

    // Handle app activation (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    import('electron').then(({ shell }) => shell.openExternal(url));
  });
});

// Export for use in other modules
export const getMainWindow = () => mainWindow;
export const showNotification = (title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
};
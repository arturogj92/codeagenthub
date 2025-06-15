# CodeAgent Hub – **MVP v0.2.0** (macOS‑only)

*15 Jun 2025 – Creator0x internal - Updated with tmux integration*

---

## 1 · Propósito

Crear un **orquestador de agentes de código** que permite gestionar múltiples instancias de Claude Code en modo interactivo usando tmux, con:

1. **4 terminales paralelos** - Una ventana para cada instancia de proyecto
2. **Modo interactivo de Claude Code** - Usando `claude code --resume` para sesiones persistentes
3. **Sistema de confirmaciones** - Modales para aprobar/rechazar cambios propuestos por Claude
4. **Notificaciones en tiempo real** - Alertas cuando tareas terminan o necesitan confirmación
5. **Gestión de tareas Kanban** - Seguimiento del estado de todas las tareas

Todo corre **localmente** con tmux manejando las sesiones persistentes de Claude Code.

---

## 2 · Arquitectura Actualizada

### 2.1 Integración con tmux + Claude Code

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron App                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  React UI                               │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │ │
│  │  │ Terminal 1  │ │ Terminal 2  │ │ Terminal 3  │  ...  │ │
│  │  │ (tmux sess) │ │ (tmux sess) │ │ (tmux sess) │       │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │            Compact Kanban Board                     │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Node.js Backend                         │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │ │
│  │  │ TmuxManager │ │ClaudeClient │ │ ConfirmationHandler │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │                 SQLite DB                           │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo de Trabajo

1. **Usuario crea tarea** → Se crea sesión tmux con `claude code --resume <session_id>`
2. **Claude ejecuta** → Se monitorea la salida en tiempo real
3. **Claude pide confirmación** → Se detecta prompt y se muestra modal
4. **Usuario confirma/rechaza** → Se envía respuesta a Claude vía tmux
5. **Tarea termina** → Notificación del sistema y actualización del estado

---

## 3 · Funcionalidades Principales

### 3.1 Interface de Usuario

#### Layout Principal
- **Sidebar colapsible** (izquierda) - Panel de control y sesiones activas
- **Grid de terminales** (centro) - 4-6 terminales redimensionables mostrando tmux sessions
- **Kanban compacto** (abajo) - Estado de todas las tareas (QUEUED/RUNNING/DONE/ERROR)
- **Notificaciones** (esquina superior derecha) - Alertas en tiempo real

#### Terminales
Cada terminal tiene:
- **Visualización de la sesión tmux** - Salida en tiempo real de Claude Code
- **Indicador de modo**:
  - 🧠 **Plan Mode** - Claude planifica antes de ejecutar
  - 🤖 **Interactive Mode** - Claude pide confirmación para cada cambio
  - ⚡ **Auto Mode** - Claude ejecuta automáticamente (auto-confirm)
- **Input de texto** - Para enviar prompts directamente
- **Indicador de archivos** - Muestra qué archivo está modificando Claude
- **Controles de sesión** - Pausar, reanudar, terminar

### 3.2 Modos de Operación

#### Plan Mode
- Claude recibe el prompt y genera un plan detallado
- Muestra el plan al usuario para aprobación
- Solo ejecuta tras confirmación del plan completo

#### Interactive Mode  
- Claude pide confirmación para cada cambio individual
- Muestra diff de cada archivo antes de modificar
- Usuario puede aprobar, rechazar, o sugerir modificaciones

#### Auto Mode
- Claude ejecuta sin interrupciones
- Útil para tareas simples o de confianza
- Notifica solo al completar

### 3.3 Sistema de Confirmaciones

#### Detección de Confirmaciones
- Monitorea salida de tmux para patrones como:
  - "Do you want to make this edit to `file.tsx`?"
  - "Should I continue with this approach?"
  - "This will modify X files. Proceed?"

#### Modal de Confirmación
- **Vista previa de cambios** - Diff visual de archivos afectados
- **Contexto** - Descripción de lo que Claude quiere hacer
- **Opciones**:
  - ✅ **Confirmar** - Envía "y" a Claude
  - ❌ **Rechazar** - Envía "n" a Claude  
  - 💬 **Mensaje personalizado** - Input para respuesta específica
- **Archivos afectados** - Lista de archivos que se van a modificar

---

## 4 · Integración técnica

### 4.1 tmux Management

```typescript
interface TmuxManager {
  // Crear nueva sesión tmux con Claude Code
  createSession(projectPath: string, sessionName: string): Promise<string>
  
  // Ejecutar comando en sesión existente
  sendCommand(sessionId: string, command: string): Promise<void>
  
  // Monitorear salida de sesión
  monitorSession(sessionId: string, callback: (output: string) => void): void
  
  // Detectar prompts de confirmación
  detectConfirmations(output: string): ConfirmationRequest[]
  
  // Responder a confirmación
  respondToConfirmation(sessionId: string, response: string): Promise<void>
}
```

### 4.2 Claude Code Integration

```typescript
interface ClaudeInteractiveClient {
  // Iniciar sesión interactiva
  startInteractiveSession(projectPath: string, mode: 'plan' | 'interactive' | 'auto'): Promise<string>
  
  // Reanudar sesión existente
  resumeSession(sessionId: string): Promise<void>
  
  // Enviar prompt
  sendPrompt(sessionId: string, prompt: string): Promise<void>
  
  // Obtener estado de sesión
  getSessionStatus(sessionId: string): Promise<SessionStatus>
}
```

### 4.3 Real-time Monitoring

```typescript
interface FileWatcher {
  // Detectar archivos siendo modificados
  watchProjectFiles(projectPath: string): Observable<FileChange>
  
  // Obtener diff de cambios
  getDiff(filePath: string): Promise<string>
}
```

---

## 5 · Base de Datos Actualizada

```sql
-- Sesiones tmux con Claude Code
CREATE TABLE sessions (
  id              INTEGER PRIMARY KEY,
  project_path    TEXT NOT NULL,
  tmux_session_id TEXT NOT NULL,
  claude_session_id TEXT,
  mode           TEXT NOT NULL, -- 'plan' | 'interactive' | 'auto'
  status         TEXT DEFAULT 'ACTIVE', -- 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tareas/Jobs ejecutándose en sesiones
CREATE TABLE jobs (
  id             INTEGER PRIMARY KEY,
  session_id     INTEGER NOT NULL,
  prompt         TEXT NOT NULL,
  status         TEXT DEFAULT 'QUEUED', -- 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR' | 'WAITING_CONFIRMATION'
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at     DATETIME,
  completed_at   DATETIME,
  error_message  TEXT,
  cost_estimate  REAL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

-- Confirmaciones pendientes
CREATE TABLE confirmations (
  id           INTEGER PRIMARY KEY,
  job_id       INTEGER NOT NULL,
  session_id   INTEGER NOT NULL,
  prompt_text  TEXT NOT NULL,
  context      TEXT,
  affected_files TEXT, -- JSON array de archivos
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at  DATETIME,
  response     TEXT,
  FOREIGN KEY(job_id) REFERENCES jobs(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

-- Log de actividad de sesiones
CREATE TABLE session_logs (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL, -- 'command' | 'output' | 'confirmation' | 'error'
  content    TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

-- Notificaciones
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY,
  type       TEXT NOT NULL, -- 'task_completed' | 'task_failed' | 'confirmation_needed'
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  job_id     INTEGER,
  session_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at    DATETIME,
  FOREIGN KEY(job_id) REFERENCES jobs(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);
```

---

## 6 · Casos de Uso Principales

### 6.1 Flujo Típico de Trabajo

1. **Iniciar sesión** - Usuario crea nueva sesión para un proyecto
2. **Seleccionar modo** - Plan/Interactive/Auto según la tarea
3. **Enviar prompt** - "Implementar autenticación JWT"
4. **Monitoreo** - Ver progreso en tiempo real en el terminal
5. **Confirmaciones** - Aprobar/rechazar cambios cuando Claude pregunta
6. **Finalización** - Recibir notificación cuando termine

### 6.2 Gestión de Múltiples Proyectos

- **4 terminales simultáneos** - Un proyecto por terminal
- **Cambio rápido entre sesiones** - Tabs o grid resizable
- **Estado independiente** - Cada proyecto mantiene su contexto
- **Notificaciones centralizadas** - Todas las alertas en un lugar

### 6.3 Colaboración y Revisión

- **Historial de cambios** - Ver todos los archivos modificados
- **Rollback** - Deshacer cambios si algo sale mal
- **Revisión antes de commit** - Ver todos los cambios antes de git commit

---

## 7 · Implementación por Fases

### Fase 1: Infraestructura Base
- ✅ Setup Electron + React + TypeScript
- ✅ Configuración de tmux y detección automática
- ✅ Cliente básico de Claude Code
- ✅ Base de datos SQLite

### Fase 2: UI y Terminales
- 🔄 **En progreso** - Layout de 4 terminales
- 🔄 **En progreso** - Sidebar colapsible
- 🔄 **En progreso** - Kanban compacto
- ⏳ Integración con tmux sessions

### Fase 3: Sistema de Confirmaciones
- ⏳ Detección de prompts de Claude
- ⏳ Modal de confirmación con diff
- ⏳ Respuesta automática a Claude

### Fase 4: Notificaciones y Monitoreo
- ⏳ Sistema de notificaciones nativo
- ⏳ Monitoreo de archivos en tiempo real
- ⏳ Indicadores de estado

### Fase 5: Funcionalidades Avanzadas
- ⏳ Diferentes modos de operación
- ⏳ Gestión de sesiones persistentes
- ⏳ Métricas y analytics

---

## 8 · Requisitos Técnicos

### 8.1 Dependencias Principales
- **tmux** - Para gestión de sesiones (auto-instalación via Homebrew)
- **Claude Code CLI** - Para interacción con Claude (requiere suscripción)
- **Electron** - Para la aplicación desktop
- **React + TypeScript** - Para la interfaz de usuario
- **SQLite** - Para persistencia local

### 8.2 Requisitos del Sistema
- **macOS 12+** - Soporte nativo para tmux y notificaciones
- **Claude Code suscripción** - Para usar el CLI interactivo
- **Git** - Para gestión de código
- **Node.js 18+** - Para Electron

---

## 9 · Próximos Pasos

1. **Limpiar estructura actual** - Remover código obsoleto
2. **Implementar layout básico** - 4 terminales + sidebar + kanban
3. **Integrar tmux** - Conectar terminales con sesiones reales
4. **Sistema de confirmaciones** - Modal para interacciones con Claude
5. **Notificaciones** - Alertas del sistema para eventos importantes

---

> **Estado actual**: Migración completa de Tauri a Electron completada. Iniciando implementación del sistema de terminales tmux con Claude Code interactivo.
import React, { useState, useEffect } from 'react'
import './src/types/electron.d.ts'

// Tipos básicos
interface Terminal {
  id: number
  name: string
  mode: 'plan' | 'interactive' | 'auto'
  claudeMode?: 'default' | 'auto-accept' | 'plan' // Modo actual de Claude (interno)
  status: 'inactive' | 'idle' | 'running' | 'waiting_confirmation'
  currentFile?: string
  output: string[]
  projectPath?: string
  sessionId?: string
}

interface Task {
  id: number
  title: string
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR'
  terminal: number
  prompt: string
  createdAt: Date
}

interface NewSessionForm {
  projectPath: string
  mode: 'plan' | 'interactive' | 'auto'
  initialPrompt: string
}

// Persistencia simple con localStorage
const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

const loadFromStorage = (key: string, defaultValue: any) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch (error) {
    console.error('Error loading from localStorage:', error)
    return defaultValue
  }
}

export default function App() {
  return (
    <div style={{ padding: '20px', color: 'white', background: '#030008', minHeight: '100vh' }}>
      <h1>CodeAgent Hub - Recuperando...</h1>
      <p>La aplicación se está reparando. Recarga en unos segundos.</p>
    </div>
  )
}
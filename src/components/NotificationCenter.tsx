import React, { useState, useEffect } from 'react'
import { Job, JobStatus } from '../types'

interface NotificationCenterProps {
  jobs: Job[]
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  jobId?: number
  autoClose?: boolean
}

export function NotificationCenter({ jobs }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [lastJobStates, setLastJobStates] = useState<Map<number, JobStatus>>(new Map())

  // Monitor job status changes
  useEffect(() => {
    const currentStates = new Map<number, JobStatus>()
    
    jobs.forEach(job => {
      const previousState = lastJobStates.get(job.id)
      const currentState = job.status
      
      currentStates.set(job.id, currentState)
      
      // Check for state changes
      if (previousState && previousState !== currentState) {
        let notification: Notification | null = null
        
        switch (currentState) {
          case JobStatus.DONE:
            notification = {
              id: `job-${job.id}-done-${Date.now()}`,
              type: 'success',
              title: 'Tarea Completada',
              message: `Job #${job.id} se ha completado exitosamente`,
              timestamp: new Date(),
              jobId: job.id,
              autoClose: true
            }
            break
            
          case JobStatus.ERROR:
            notification = {
              id: `job-${job.id}-error-${Date.now()}`,
              type: 'error',
              title: 'Error en Tarea',
              message: `Job #${job.id} ha fallado`,
              timestamp: new Date(),
              jobId: job.id,
              autoClose: false
            }
            break
            
          case JobStatus.RUNNING:
            if (previousState === JobStatus.QUEUED) {
              notification = {
                id: `job-${job.id}-running-${Date.now()}`,
                type: 'info',
                title: 'Tarea Iniciada',
                message: `Job #${job.id} está ejecutándose`,
                timestamp: new Date(),
                jobId: job.id,
                autoClose: true
              }
            }
            break
        }
        
        if (notification) {
          setNotifications(prev => [notification!, ...prev].slice(0, 50)) // Keep last 50 notifications
          
          // Auto-close notifications after 5 seconds
          if (notification.autoClose) {
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notification!.id))
            }, 5000)
          }
        }
      }
    })
    
    setLastJobStates(currentStates)
  }, [jobs, lastJobStates])

  const unreadCount = notifications.filter(n => 
    n.timestamp > new Date(Date.now() - 30000) // Last 30 seconds
  ).length

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'error':
        return <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'warning':
        return <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
      case 'info':
        return <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
  }

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500/10 border-green-500/20'
      case 'error': return 'bg-red-500/10 border-red-500/20'
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20'
      case 'info': return 'bg-blue-500/10 border-blue-500/20'
    }
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM15 17h5l-5 5v-5zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-card border border-color rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-color/20 flex items-center justify-between">
            <h3 className="text-white font-semibold">Notificaciones</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted">{notifications.length}</span>
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                No hay notificaciones
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-color/10 hover:bg-white/5 transition-colors ${getNotificationBg(notification.type)}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </h4>
                        <button
                          onClick={() => clearNotification(notification.id)}
                          className="text-muted hover:text-white transition-colors ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-muted mt-1">{notification.message}</p>
                      <p className="text-xs text-muted/75 mt-1">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
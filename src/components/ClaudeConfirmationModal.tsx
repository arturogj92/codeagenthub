import React from 'react'
import { useAllPendingConfirmations, useRespondToConfirmation } from '../hooks/useElectron'

interface ClaudeConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ClaudeConfirmationModal({ isOpen, onClose }: ClaudeConfirmationModalProps) {
  const { data: confirmations = [] } = useAllPendingConfirmations()
  const respondToConfirmation = useRespondToConfirmation()

  if (!isOpen || confirmations.length === 0) {
    return null
  }

  const handleRespond = (confirmationId: number, approved: boolean) => {
    respondToConfirmation.mutate({ confirmationId, approved }, {
      onSuccess: () => {
        // Close modal if no more confirmations
        if (confirmations.length === 1) {
          onClose()
        }
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-color rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg className="w-6 h-6 text-yellow-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Claude Confirmation Required
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {confirmations.map((confirmation, index) => (
            <div
              key={confirmation.id}
              className="bg-background/50 border border-color/30 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-primary">
                      Job #{confirmation.jobId}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(confirmation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-black/50 border border-gray-700 rounded-lg p-3 font-mono text-sm">
                    <pre className="whitespace-pre-wrap text-green-400">
                      {confirmation.output}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  Claude is asking for your confirmation to proceed with this action.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleRespond(confirmation.id, false)}
                    disabled={respondToConfirmation.isPending}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ❌ Deny
                  </button>
                  <button
                    onClick={() => handleRespond(confirmation.id, true)}
                    disabled={respondToConfirmation.isPending}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ✅ Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {confirmations.length > 1 && (
          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center space-x-2 text-yellow-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>You have {confirmations.length} pending confirmations from Claude</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// src/components/Toast.jsx
import { useState, useEffect, useCallback } from 'react'
import './Toast.css'

let toastQueue = []
let listeners = []

export function showToast(message, type = 'info', duration = 3000) {
  const id = Date.now() + Math.random()
  const toast = { id, message, type, duration }
  toastQueue.push(toast)
  listeners.forEach(fn => fn([...toastQueue]))
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== id)
    listeners.forEach(fn => fn([...toastQueue]))
  }, duration)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (updated) => setToasts(updated)
    listeners.push(handler)
    return () => { listeners = listeners.filter(l => l !== handler) }
  }, [])

  const dismiss = useCallback((id) => {
    toastQueue = toastQueue.filter(t => t.id !== id)
    setToasts([...toastQueue])
  }, [])

  if (!toasts.length) return null

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : t.type === 'error' ? '✗' : 'ℹ'}
          </span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  )
}

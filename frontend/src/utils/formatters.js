// src/utils/formatters.js
// Formatting utilities for display values throughout the app

/**
 * Format a CO₂ value for display.
 * @param {number} tonnes - CO₂ in tonnes
 * @param {boolean} includeUnit
 */
export function formatCO2(tonnes, includeUnit = true) {
  if (tonnes == null || isNaN(tonnes)) return '—'
  const rounded = Math.round(tonnes * 10) / 10
  return includeUnit ? `${rounded}T` : `${rounded}`
}

/**
 * Format kg of CO₂ (for savings displays).
 * @param {number} kg
 */
export function formatKgCO2(kg) {
  if (kg == null || isNaN(kg)) return '—'
  return `${Math.round(kg)} kg CO₂`
}

/**
 * Format a Firestore timestamp or JS Date to a short date string.
 * @param {Date|{seconds: number}|string} timestamp
 */
export function formatDate(timestamp) {
  if (!timestamp) return '—'
  let date
  if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000)
  } else if (timestamp instanceof Date) {
    date = timestamp
  } else {
    date = new Date(timestamp)
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Format date as short "MMM DD" for chart labels.
 * @param {Date|{seconds: number}|string} timestamp
 */
export function formatShortDate(timestamp) {
  if (!timestamp) return '—'
  let date
  if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000)
  } else {
    date = new Date(timestamp)
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Format a currency value (Indian Rupees).
 * @param {number} amount
 */
export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format AQI category with a color class.
 * @param {number} aqi
 * @returns {{ label: string, color: string }}
 */
export function formatAQI(aqi) {
  if (aqi <= 50) return { label: 'Good', color: '#1D9E75' }
  if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' }
  if (aqi <= 200) return { label: 'Poor', color: '#f97316' }
  if (aqi <= 300) return { label: 'Very Poor', color: '#ef4444' }
  return { label: 'Severe', color: '#7c3aed' }
}

/**
 * Get a relative time string ("2 hours ago", "Yesterday").
 * @param {Date|string} timestamp
 */
export function timeAgo(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

/**
 * Truncate a file name for display.
 * @param {string} name
 * @param {number} maxLen
 */
export function truncateFilename(name, maxLen = 24) {
  if (!name || name.length <= maxLen) return name
  const ext = name.split('.').pop()
  return `${name.slice(0, maxLen - ext.length - 4)}...${ext}`
}

/**
 * Format bytes to human-readable file size.
 * @param {number} bytes
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// src/App.jsx
// Main router with lazy loading and error boundaries

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import SkeletonLoader from './components/SkeletonLoader'

// Code splitting — each page loads on demand
const Calculator = lazy(() => import('./pages/Calculator'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AICoach = lazy(() => import('./pages/AICoach'))
const Offset = lazy(() => import('./pages/Offset'))

function PageLoader() {
  return (
    <div
      className="app-shell"
      style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 16, padding: 32 }}
      role="status"
      aria-label="Loading page"
    >
      <div style={{ fontSize: 28, animation: 'pulse 1.5s ease-in-out infinite' }}>🌿</div>
      <SkeletonLoader width="50%" height="12px" />
      <SkeletonLoader width="35%" height="10px" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/calculator" replace />} />

          {/* Core screens */}
          <Route
            path="/calculator"
            element={
              <ErrorBoundary>
                <Calculator />
              </ErrorBoundary>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="/ai-coach"
            element={
              <ErrorBoundary>
                <AICoach />
              </ErrorBoundary>
            }
          />
          <Route
            path="/offset"
            element={
              <ErrorBoundary>
                <Offset />
              </ErrorBoundary>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/calculator" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}


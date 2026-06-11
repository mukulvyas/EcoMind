import { Routes, Route, Navigate } from 'react-router-dom'
import Calculator from './pages/Calculator'
import Dashboard from './pages/Dashboard'
import AICoach from './pages/AICoach'
import Offset from './pages/Offset'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/calculator" replace />} />
      <Route path="/calculator" element={<Calculator />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/ai-coach" element={<AICoach />} />
      <Route path="/offset" element={<Offset />} />
    </Routes>
  )
}

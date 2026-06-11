import { Link } from 'react-router-dom'
import { Sprout } from 'lucide-react'


export default function AppHeader({ badgeLarge = false, rightContent }) {
  return (
    <header className="app-header">
      <Link to="/calculator" className="header-logo">
        <div className="header-logo-icon">
          <Sprout size={18} />
        </div>
        <span className="header-logo-text">EcoMind</span>
      </Link>
      {rightContent || (
        <div className={`header-badge ${badgeLarge ? 'header-badge-lg' : ''}`}>
          <span style={{ fontSize: badgeLarge ? 14 : 12 }}>✦</span>
          AI Powered
        </div>
      )}
    </header>
  )
}

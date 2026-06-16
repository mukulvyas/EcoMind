// src/components/AppHeader.jsx
import { Link } from 'react-router-dom'
import { Sprout } from 'lucide-react'
import PropTypes from 'prop-types'

export default function AppHeader({ badgeLarge, rightContent }) {
  return (
    <header className="app-header" role="banner">
      <Link
        to="/calculator"
        className="header-logo"
        aria-label="EcoMind home"
      >
        <div className="header-logo-icon" aria-hidden="true">
          <Sprout size={18} />
        </div>
        <span className="header-logo-text">EcoMind</span>
      </Link>
      {rightContent || (
        <div
          className={`header-badge ${badgeLarge ? 'header-badge-lg' : ''}`}
          aria-label="AI Powered platform"
        >
          <span aria-hidden="true" style={{ fontSize: badgeLarge ? 14 : 12 }}>✦</span>
          AI Powered
        </div>
      )}
    </header>
  )
}

AppHeader.propTypes = {
  badgeLarge: PropTypes.bool,
  rightContent: PropTypes.node,
}

AppHeader.defaultProps = {
  badgeLarge: false,
  rightContent: null,
}

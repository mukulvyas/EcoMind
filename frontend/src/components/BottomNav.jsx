// src/components/BottomNav.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { Calculator, LayoutDashboard, Bot, Leaf } from 'lucide-react'
import PropTypes from 'prop-types'

const NAV_ITEMS = [
  { path: '/calculator', label: 'Calculator', Icon: Calculator },
  { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/ai-coach', label: 'AI Coach', Icon: Bot },
  { path: '/offset', label: 'Offset', Icon: Leaf },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const isActive = pathname === path
        return (
          <button
            key={path}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

BottomNav.propTypes = {}

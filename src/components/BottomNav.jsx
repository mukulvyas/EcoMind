import { useNavigate, useLocation } from 'react-router-dom'
import { Calculator, LayoutDashboard, Bot, Leaf } from 'lucide-react'

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
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, label, Icon }) => (
        <button
          key={path}
          className={`nav-item ${pathname === path ? 'active' : ''}`}
          onClick={() => navigate(path)}
        >
          <Icon size={22} strokeWidth={pathname === path ? 2.5 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

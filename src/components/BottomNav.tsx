import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { to: '/stock', icon: '📦', label: 'Stock' },
  { to: '/', icon: '🛒', label: 'Courses' },
  { to: '/recettes', icon: '📖', label: 'Recettes' },
  { to: '/profil', icon: '👤', label: 'Profil' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const active = tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)
        return (
          <button
            key={tab.to}
            className={`bottom-nav__tab${active ? ' bottom-nav__tab--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.to)}
          >
            <span className="bottom-nav__icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

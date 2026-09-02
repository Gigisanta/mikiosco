import {
  BarChart3,
  Box,
  LayoutDashboard,
  PackageCheck,
  ShoppingBag,
  WalletCards,
} from 'lucide-react'

const items = [
  [LayoutDashboard, 'Resumen'],
  [ShoppingBag, 'Ventas'],
  [Box, 'Productos'],
  [PackageCheck, 'Stock'],
  [BarChart3, 'Estadísticas'],
  [WalletCards, 'Caja'],
]

export function Sidebar({ section, setSection, menuOpen, setMenuOpen, lowStockCount }) {
  return (
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand">
        <span className="brand-mark">m</span>
        <span>
          mikiosco<span className="dot">.</span>app
        </span>
      </div>
      <div className="store-select">
        <span>Mi Kiosco</span>
      </div>
      <nav aria-label="Navegación principal">
        {items.map(([Icon, label]) => (
          <button
            key={label}
            className={section === label ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setSection(label)
              setMenuOpen(false)
            }}
          >
            <Icon size={19} aria-hidden="true" />
            {label}
            {label === 'Stock' && lowStockCount > 0 && (
              <span className="nav-count">{lowStockCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="help" aria-hidden="true">
          ?
        </span>
        <div>
          <strong>Tomás</strong>
          <span>Administrador</span>
        </div>
        <div className="avatar" aria-hidden="true">
          T
        </div>
      </div>
    </aside>
  )
}

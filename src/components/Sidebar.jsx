import {
  BarChart3,
  Box,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  ShoppingBag,
  Truck,
  UsersRound,
  WalletCards,
} from 'lucide-react'

const items = [
  [LayoutDashboard, 'Resumen'],
  [ShoppingBag, 'Ventas'],
  [Box, 'Productos'],
  [PackageCheck, 'Stock'],
  [UsersRound, 'Clientes'],
  [Truck, 'Proveedores'],
  [BarChart3, 'Estadísticas'],
  [WalletCards, 'Caja'],
]

export function Sidebar({
  section,
  setSection,
  menuOpen,
  setMenuOpen,
  lowStockCount,
  role = 'ADMIN',
  user,
  branch,
  onLogout,
}) {
  const visibleItems = items.filter(([, label]) => role !== 'CASHIER' || label !== 'Estadísticas')
  return (
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand">
        <span className="brand-mark">m</span>
        <span>
          mikiosco<span className="dot">.</span>app
        </span>
      </div>
      <div className="store-select">
        <span>{branch?.name || 'Mi Kiosco'}</span>
      </div>
      <nav aria-label="Navegación principal">
        {visibleItems.map(([Icon, label]) => (
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
          <strong>{user?.name || 'Usuario'}</strong>
          <span>
            {{ ADMIN: 'Administrador', CASHIER: 'Cajero', VIEWER: 'Solo consulta' }[role]}
          </span>
        </div>
        {onLogout ? (
          <button className="logout-button" aria-label="Cerrar sesión" onClick={onLogout}>
            <LogOut size={16} />
          </button>
        ) : (
          <div className="avatar" aria-hidden="true">
            {(user?.name || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </aside>
  )
}

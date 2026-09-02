import { CalendarDays, Menu } from 'lucide-react'

export function Topbar({ section, dateLabel, onMenu }) {
  return (
    <header className="topbar">
      <button className="mobile-menu" aria-label="Abrir menú" onClick={onMenu}>
        <Menu size={22} />
      </button>
      <div>
        <span className="eyebrow">
          {section === 'Ventas' ? 'PUNTO DE VENTA' : 'GESTIÓN DEL KIOSCO'}
        </span>
        <h1>{section === 'Ventas' ? 'Nueva venta' : section}</h1>
      </div>
      <div className="today">
        <CalendarDays size={17} aria-hidden="true" /> {dateLabel}
      </div>
    </header>
  )
}

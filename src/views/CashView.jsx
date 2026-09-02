import { WalletCards } from 'lucide-react'
import { money } from '../lib/format'

export function CashView({ sales }) {
  const cashSales = sales
    .filter((sale) => sale.payment === 'Efectivo')
    .reduce((sum, sale) => sum + sale.total, 0)

  return (
    <section className="management">
      <div className="demo-label">Caja de demostración — todavía no conectada al servidor</div>
      <div className="cash-card">
        <div className="cash-head">
          <div>
            <span className="eyebrow">SIN TURNO ABIERTO</span>
            <h2>Caja del día</h2>
            <p>La apertura y el cierre se habilitarán al iniciar sesión.</p>
          </div>
          <div className="cash-icon">
            <WalletCards size={32} />
          </div>
        </div>
        <div className="cash-numbers">
          <div>
            <span>Fondo inicial</span>
            <strong>{money.format(0)}</strong>
          </div>
          <div>
            <span>Ventas en efectivo</span>
            <strong>{money.format(cashSales)}</strong>
          </div>
          <div>
            <span>Dinero esperado</span>
            <strong>{money.format(cashSales)}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

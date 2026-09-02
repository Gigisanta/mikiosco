import { AlertTriangle, ArrowDownToLine, ShoppingBag } from 'lucide-react'
import { Metric } from '../components/Metric'
import { money } from '../lib/format'

export function DashboardView({ products, sales, onNavigate, demoMode }) {
  const low = products.filter((product) => product.stock <= product.min)
  const todayRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const average = sales.length ? todayRevenue / sales.length : 0

  return (
    <section className="management">
      {demoMode && <div className="demo-label">Datos de ejemplo</div>}
      <div className="metric-grid">
        <Metric
          icon={<ArrowDownToLine />}
          label="Ventas registradas"
          value={money.format(todayRevenue)}
          detail={demoMode ? 'En este navegador' : 'Datos compartidos de la sucursal'}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Tickets emitidos"
          value={String(sales.length)}
          detail={`Promedio ${money.format(average)}`}
        />
        <Metric
          icon={<AlertTriangle />}
          label="Stock bajo"
          value={`${low.length} productos`}
          detail="Revisar reposición"
          warning
        />
      </div>
      <div className="notice">
        <AlertTriangle size={22} />
        <div>
          <strong>
            {low.length
              ? `${low.length} productos necesitan reposición`
              : 'El stock está dentro de los límites'}
          </strong>
          <span>MiKiosco compara existencias con el mínimo de cada producto.</span>
        </div>
        <button onClick={() => onNavigate('Stock')}>Ver stock</button>
      </div>
    </section>
  )
}

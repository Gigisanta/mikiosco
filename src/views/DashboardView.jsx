import { AlertTriangle, ArrowDownToLine, Clock3, ShoppingBag, WalletCards } from 'lucide-react'
import { Metric } from '../components/Metric'
import { money } from '../lib/format'

export function DashboardView({ products, sales, onNavigate, demoMode, cashSession }) {
  const low = products.filter((product) => product.stock <= product.min)
  const todayKey = new Date().toDateString()
  const todaySales = sales.filter(
    (sale) =>
      sale.status !== 'VOIDED' && new Date(sale.date || sale.createdAt).toDateString() === todayKey,
  )
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0)
  const average = todaySales.length ? todayRevenue / todaySales.length : 0
  const hourly = Array.from({ length: 16 }, (_, index) => {
    const hour = index + 8
    return {
      hour,
      total: todaySales
        .filter((sale) => new Date(sale.date || sale.createdAt).getHours() === hour)
        .reduce((sum, sale) => sum + Number(sale.total), 0),
    }
  })
  const maxHour = Math.max(1, ...hourly.map((entry) => entry.total))

  return (
    <section className="management">
      {demoMode && <div className="demo-label">Datos de ejemplo</div>}
      <div className="metric-grid">
        <Metric
          icon={<ArrowDownToLine />}
          label="Ventas de hoy"
          value={money.format(todayRevenue)}
          detail={demoMode ? 'Datos de ejemplo' : 'Datos compartidos de la sucursal'}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Tickets emitidos"
          value={String(todaySales.length)}
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
      <div className="dashboard-grid">
        <section className="dashboard-panel hourly-panel">
          <div className="panel-title">
            <div>
              <h2>Ventas por hora</h2>
              <p>Ritmo del día actual.</p>
            </div>
            <Clock3 size={20} />
          </div>
          <div className="hourly-chart" aria-label="Ventas de hoy por hora">
            {hourly.map((entry) => (
              <div key={entry.hour} title={`${entry.hour}:00 · ${money.format(entry.total)}`}>
                <i
                  style={{
                    height: `${Math.max(entry.total ? 6 : 1, (entry.total / maxHour) * 100)}%`,
                  }}
                />
                {entry.hour % 2 === 0 && <small>{entry.hour}</small>}
              </div>
            ))}
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Últimos tickets</h2>
              <p>Las ventas más recientes de hoy.</p>
            </div>
          </div>
          <div className="compact-list">
            {todaySales.length ? (
              [...todaySales]
                .reverse()
                .slice(0, 5)
                .map((sale) => (
                  <div key={sale.id}>
                    <span>
                      <strong>Ticket {sale.ticketNumber || String(sale.id).slice(-5)}</strong>
                      <small>
                        {new Date(sale.date || sale.createdAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </span>
                    <b>{money.format(Number(sale.total))}</b>
                  </div>
                ))
            ) : (
              <p className="empty-row">Todavía no hay ventas hoy.</p>
            )}
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-title">
            <div>
              <h2>Reposición prioritaria</h2>
              <p>Los productos más comprometidos.</p>
            </div>
          </div>
          <div className="compact-list">
            {low.slice(0, 5).map((product) => (
              <div key={product.id}>
                <span>
                  <strong>{product.name}</strong>
                  <small>
                    Mínimo {product.min} {product.unit}
                  </small>
                </span>
                <b>
                  {product.stock} {product.unit}
                </b>
              </div>
            ))}
          </div>
          <button className="panel-link" onClick={() => onNavigate('Stock')}>
            Gestionar stock
          </button>
        </section>
        <section className="dashboard-panel cash-status-panel">
          <div className="panel-title">
            <div>
              <h2>Estado de caja</h2>
              <p>{cashSession ? 'Turno operativo' : 'No hay una caja abierta'}</p>
            </div>
            <WalletCards size={20} />
          </div>
          <strong>{cashSession ? 'Caja abierta' : 'Caja pendiente'}</strong>
          <button className="panel-link" onClick={() => onNavigate('Caja')}>
            Ir a caja
          </button>
        </section>
      </div>
    </section>
  )
}

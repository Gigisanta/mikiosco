import { CircleDollarSign, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react'
import { Metric } from '../components/Metric'
import { money, number } from '../lib/format'

function demoStatistics(sales) {
  const monthlyMap = new Map()
  const productMap = new Map()
  const categoryMap = new Map()
  sales
    .filter((sale) => sale.status !== 'VOIDED')
    .forEach((sale) => {
      const date = new Date(sale.date || sale.createdAt)
      const month = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
      const entry = monthlyMap.get(month) || { month, revenue: 0, profit: 0, tickets: 0 }
      entry.revenue += Number(sale.total)
      entry.profit += Number(sale.total) - Number(sale.cost || 0)
      entry.tickets += 1
      monthlyMap.set(month, entry)
      sale.items.forEach((item) => {
        const product = productMap.get(item.id) || {
          id: item.id,
          name: item.name,
          quantity: 0,
          revenue: 0,
          profit: 0,
          margin: 0,
        }
        product.quantity += Number(item.quantity)
        product.revenue += Number(item.total)
        product.profit += Number(item.margin || 0)
        product.margin = product.revenue ? product.profit / product.revenue : 0
        productMap.set(item.id, product)
        categoryMap.set(
          item.category,
          Number(categoryMap.get(item.category) || 0) + Number(item.total),
        )
      })
    })
  const products = [...productMap.values()]
  return {
    monthly: [...monthlyMap.values()].sort((a, b) => new Date(a.month) - new Date(b.month)),
    bestSellers: [...products].sort((a, b) => b.quantity - a.quantity),
    bestMargins: [...products].sort((a, b) => b.profit - a.profit),
    categories: [...categoryMap].map(([category, revenue]) => ({ category, revenue })),
  }
}

function monthSeries(monthly) {
  const values = new Map(
    monthly.map((entry) => {
      const date = new Date(entry.month)
      return [`${date.getFullYear()}-${date.getMonth()}`, entry]
    }),
  )
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (11 - index))
    const entry = values.get(`${date.getFullYear()}-${date.getMonth()}`) || {}
    return {
      label: date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
      revenue: Number(entry.revenue || 0),
      profit: Number(entry.profit || 0),
      tickets: Number(entry.tickets || 0),
      partial: index === 11,
    }
  })
}

export function StatisticsView({ data, sales, demoMode, loading }) {
  if (loading) return <StatisticsSkeleton />
  const statistics = data || demoStatistics(sales)
  const months = monthSeries(statistics.monthly || [])
  const current = months.at(-1)
  const maxRevenue = Math.max(1, ...months.map((month) => month.revenue))
  const yMarks = [maxRevenue, maxRevenue * 0.66, maxRevenue * 0.33, 0]
  const categories = [...(statistics.categories || [])].sort(
    (a, b) => Number(b.revenue) - Number(a.revenue),
  )
  const categoryTotal = categories.reduce((sum, category) => sum + Number(category.revenue), 0)
  const unitsSold = (statistics.bestSellers || []).reduce(
    (sum, product) => sum + Number(product.quantity),
    0,
  )

  return (
    <section className="management analytics-page">
      <div className="analytics-intro">
        <div>
          <p>Entendé qué vende más, dónde está tu ganancia y cómo evoluciona el negocio.</p>
          {demoMode && <small className="demo-label">Datos de ejemplo</small>}
        </div>
        <span>Últimos 12 meses</span>
      </div>
      <div className="analytics-kpis">
        <Metric
          icon={<CircleDollarSign />}
          label="Facturación del mes"
          value={money.format(current.revenue)}
          detail="Mes en curso"
        />
        <Metric
          icon={<TrendingUp />}
          label="Ganancia bruta"
          value={money.format(current.profit)}
          detail={`${current.revenue ? ((current.profit / current.revenue) * 100).toFixed(1) : 0}% de margen`}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Ticket promedio"
          value={money.format(current.revenue / Math.max(1, current.tickets))}
          detail={`${current.tickets} ventas del mes`}
        />
        <Metric
          icon={<PackageCheck />}
          label="Unidades vendidas"
          value={number.format(unitsSold)}
          detail="En el período analizado"
        />
      </div>
      <div className="analytics-grid">
        <article className="analytics-panel wide">
          <div className="panel-title">
            <div>
              <h2>Ventas y ganancia mensual</h2>
              <p>Comparación de facturación y margen bruto.</p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-sales" /> Ventas
              </span>
              <span>
                <i className="legend-profit" /> Ganancia
              </span>
            </div>
          </div>
          <div className="chart-with-axis">
            <div className="y-axis">
              {yMarks.map((value) => (
                <span key={value}>{money.format(value)}</span>
              ))}
            </div>
            <div className="monthly-chart">
              {months.map((month) => (
                <div
                  className={month.partial ? 'month-column partial' : 'month-column'}
                  key={month.label}
                >
                  <div className="bar-stack">
                    <div
                      className="revenue-bar"
                      style={{
                        height: `${Math.max(month.revenue ? 4 : 0, (month.revenue / maxRevenue) * 100)}%`,
                      }}
                      title={`Ventas ${money.format(month.revenue)}`}
                    />
                    <div
                      className="profit-bar"
                      style={{
                        height: `${Math.max(month.profit ? 3 : 0, (month.profit / maxRevenue) * 100)}%`,
                      }}
                      title={`Ganancia ${money.format(month.profit)}`}
                    />
                  </div>
                  <span>{month.label}</span>
                  {month.partial && <small>Parcial</small>}
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="analytics-panel">
          <div className="panel-title">
            <div>
              <h2>Participación por categoría</h2>
              <p>Qué parte de la facturación aporta cada rubro.</p>
            </div>
          </div>
          <div className="category-list">
            {categories.length ? (
              categories.map((category, index) => (
                <div key={category.category}>
                  <div>
                    <strong>{category.category}</strong>
                    <span>
                      {categoryTotal
                        ? ((Number(category.revenue) / categoryTotal) * 100).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <span className="category-bar">
                    <i
                      style={{
                        width: `${(Number(category.revenue) / Number(categories[0].revenue || 1)) * 100}%`,
                        opacity: 1 - index * 0.12,
                      }}
                    />
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-row">Todavía no hay ventas para comparar categorías.</p>
            )}
          </div>
        </article>
        <Ranking
          title="Más vendidos"
          subtitle="Productos con mayor rotación."
          items={(statistics.bestSellers || []).slice(0, 5).map((product) => ({
            ...product,
            detail: `${number.format(Number(product.quantity))} vendidos`,
            value: money.format(Number(product.revenue)),
          }))}
        />
        <Ranking
          title="Mayor margen aportado"
          subtitle="Ganancia total por producto."
          items={(statistics.bestMargins || []).slice(0, 5).map((product) => ({
            ...product,
            detail: `${(Number(product.margin) * 100).toFixed(1)}% por venta`,
            value: money.format(Number(product.profit)),
          }))}
        />
      </div>
    </section>
  )
}

function Ranking({ title, subtitle, items }) {
  return (
    <article className="analytics-panel">
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="ranking-list">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id || item.name}>
              <span className="rank">{index + 1}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.detail}</small>
              </div>
              <b>{item.value}</b>
            </div>
          ))
        ) : (
          <p className="empty-row">Todavía no hay datos suficientes.</p>
        )}
      </div>
    </article>
  )
}

function StatisticsSkeleton() {
  return (
    <section className="management analytics-page" aria-label="Cargando estadísticas">
      <div className="skeleton-row">
        <span />
        <span />
        <span />
      </div>
      <div className="skeleton-panel" />
    </section>
  )
}

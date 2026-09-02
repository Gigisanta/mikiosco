import { CircleDollarSign, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react'
import { Metric } from '../components/Metric'
import { DEMO_MONTHS } from '../data/demoData'
import { money, number } from '../lib/format'
import { marginPercent, unitLabel } from '../lib/inventory'

export function StatisticsView({ products, sales }) {
  const extraRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const extraProfit = sales.reduce((sum, sale) => sum + sale.total - sale.cost, 0)
  const months = DEMO_MONTHS.map((month, index) =>
    index === 11 ? [month[0], month[1] + extraRevenue, month[2] + extraProfit] : month,
  )
  const maxRevenue = Math.max(...months.map((month) => month[1]))
  const monthRevenue = months[11][1]
  const monthProfit = months[11][2]
  const rankedSales = [...products].sort((a, b) => b.sold - a.sold)
  const rankedMargin = [...products].sort(
    (a, b) => (b.price - b.cost) * b.sold - (a.price - a.cost) * a.sold,
  )
  const categories = Object.values(
    products.reduce((result, product) => {
      result[product.category] ||= { name: product.category, total: 0 }
      result[product.category].total += product.sold * product.price
      return result
    }, {}),
  ).sort((a, b) => b.total - a.total)
  const totalCategory = categories.reduce((sum, category) => sum + category.total, 0)

  return (
    <section className="management analytics-page">
      <div className="analytics-intro">
        <div>
          <p>Entendé qué vende más, dónde está tu ganancia y cómo evoluciona el negocio.</p>
          <small className="demo-label">Datos de ejemplo combinados con esta sesión</small>
        </div>
        <span>Últimos 12 meses</span>
      </div>
      <div className="analytics-kpis">
        <Metric
          icon={<CircleDollarSign />}
          label="Facturación del mes"
          value={money.format(monthRevenue)}
          detail="Mes en curso"
        />
        <Metric
          icon={<TrendingUp />}
          label="Ganancia bruta"
          value={money.format(monthProfit)}
          detail={`${((monthProfit / monthRevenue) * 100).toFixed(1)}% de margen`}
        />
        <Metric
          icon={<ShoppingBag />}
          label="Ticket promedio"
          value={money.format(monthRevenue / Math.max(1, sales.length))}
          detail={`${sales.length} ventas reales de esta sesión`}
        />
        <Metric
          icon={<PackageCheck />}
          label="Unidades vendidas"
          value={number.format(products.reduce((sum, product) => sum + product.sold, 0))}
          detail="Según unidad de medida"
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
                <i className="legend-sales" />
                Ventas
              </span>
              <span>
                <i className="legend-profit" />
                Ganancia
              </span>
            </div>
          </div>
          <div className="monthly-chart">
            {months.map(([label, revenue, profit]) => (
              <div className="month-column" key={label}>
                <div className="bar-stack">
                  <div
                    className="revenue-bar"
                    style={{ height: `${Math.max(5, (revenue / maxRevenue) * 100)}%` }}
                    title={`Ventas ${money.format(revenue)}`}
                  />
                  <div
                    className="profit-bar"
                    style={{ height: `${Math.max(3, (profit / maxRevenue) * 100)}%` }}
                    title={`Ganancia ${money.format(profit)}`}
                  />
                </div>
                <span>{label}</span>
              </div>
            ))}
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
            {categories.map((category, index) => (
              <div key={category.name}>
                <div>
                  <strong>{category.name}</strong>
                  <span>{((category.total / totalCategory) * 100).toFixed(0)}%</span>
                </div>
                <span className="category-bar">
                  <i
                    style={{
                      width: `${(category.total / categories[0].total) * 100}%`,
                      opacity: 1 - index * 0.16,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </article>
        <Ranking
          title="Más vendidos"
          subtitle="Productos con mayor rotación."
          items={rankedSales.slice(0, 5).map((product) => ({
            ...product,
            detail: `${unitLabel(product.sold, product.unit)} vendidos`,
            value: money.format(product.sold * product.price),
          }))}
        />
        <Ranking
          title="Mayor margen aportado"
          subtitle="Ganancia total estimada por producto."
          items={rankedMargin.slice(0, 5).map((product) => ({
            ...product,
            detail: `${(marginPercent(product) * 100).toFixed(1)}% por venta`,
            value: money.format((product.price - product.cost) * product.sold),
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
        {items.map((item, index) => (
          <div key={item.id}>
            <span className="rank">{index + 1}</span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </div>
            <b>{item.value}</b>
          </div>
        ))}
      </div>
    </article>
  )
}

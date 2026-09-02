import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { Metric } from '../components/Metric'
import { money, number } from '../lib/format'

const CURRENT_MONTH = new Date().toISOString().slice(0, 7)

function asNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}/.test(value)) return value.slice(0, 7)
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(value, style = 'long') {
  const [year, month] = monthKey(value).split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-AR', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  }).format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '')
}

function normalizeSummary(entry = {}) {
  return {
    month: entry.month || CURRENT_MONTH,
    revenue: asNumber(entry.revenue),
    costOfGoods: asNumber(entry.costOfGoods),
    grossProfit: asNumber(entry.grossProfit ?? entry.profit),
    grossMargin: asNumber(entry.grossMargin),
    tickets: asNumber(entry.tickets),
    unitsSold: asNumber(entry.unitsSold),
    purchases: asNumber(entry.purchases),
    supplierPayments: asNumber(entry.supplierPayments),
    operatingExpenses: asNumber(entry.operatingExpenses),
    operatingResult: asNumber(entry.operatingResult ?? entry.grossProfit ?? entry.profit),
    topProductName: entry.topProductName || '',
    topProductQuantity: asNumber(entry.topProductQuantity),
  }
}

function percentageChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function comparisonText(current, previous) {
  const change = percentageChange(current, previous)
  if (change === null) return 'Sin base del mes anterior'
  if (Math.abs(change) < 0.05) return 'Sin cambios frente al mes anterior'
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}% frente al mes anterior`
}

function buildMonthSeries(monthly, anchorMonth) {
  const values = new Map(monthly.map((entry) => [monthKey(entry.month), normalizeSummary(entry)]))
  const [anchorYear, anchorNumber] = anchorMonth.split('-').map(Number)
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(anchorYear, anchorNumber - 1 - (11 - index), 1)
    const key = monthKey(date)
    return {
      ...normalizeSummary(values.get(key)),
      month: key,
      label: monthLabel(key, 'short'),
      partial: key === CURRENT_MONTH,
    }
  })
}

function demoStatistics(sales, requestedMonth) {
  const monthlyMap = new Map()
  const productsByMonth = new Map()
  const categoriesByMonth = new Map()

  sales
    .filter((sale) => sale.status !== 'VOIDED')
    .forEach((sale) => {
      const key = monthKey(sale.date || sale.createdAt)
      const cost = asNumber(sale.cost)
      const entry = monthlyMap.get(key) || {
        month: key,
        revenue: 0,
        costOfGoods: 0,
        grossProfit: 0,
        tickets: 0,
        unitsSold: 0,
      }
      entry.revenue += asNumber(sale.total)
      entry.costOfGoods += cost
      entry.grossProfit += asNumber(sale.total) - cost
      entry.tickets += 1

      const monthProducts = productsByMonth.get(key) || new Map()
      const monthCategories = categoriesByMonth.get(key) || new Map()
      ;(sale.items || []).forEach((item) => {
        entry.unitsSold += asNumber(item.quantity)
        const product = monthProducts.get(item.id) || {
          id: item.id,
          name: item.name,
          unit: item.unit || 'unidad',
          quantity: 0,
          revenue: 0,
          profit: 0,
          margin: 0,
        }
        product.quantity += asNumber(item.quantity)
        product.revenue += asNumber(item.total)
        product.profit += asNumber(item.margin)
        product.margin = product.revenue ? product.profit / product.revenue : 0
        monthProducts.set(item.id, product)
        const category = item.category || 'Sin categoría'
        monthCategories.set(
          category,
          asNumber(monthCategories.get(category)) + asNumber(item.total),
        )
      })
      monthlyMap.set(key, entry)
      productsByMonth.set(key, monthProducts)
      categoriesByMonth.set(key, monthCategories)
    })

  const monthly = [...monthlyMap.values()]
    .map((entry) => {
      const products = [...(productsByMonth.get(entry.month)?.values() || [])].sort(
        (a, b) => b.quantity - a.quantity,
      )
      const purchases = entry.costOfGoods * 1.08
      const operatingExpenses = entry.revenue * 0.025
      return {
        ...entry,
        grossMargin: entry.revenue ? entry.grossProfit / entry.revenue : 0,
        purchases,
        supplierPayments: purchases * 0.88,
        operatingExpenses,
        operatingResult: entry.grossProfit - operatingExpenses,
        topProductName: products[0]?.name || '',
        topProductQuantity: products[0]?.quantity || 0,
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const activeMonth = requestedMonth || monthly.at(-1)?.month || CURRENT_MONTH
  const selectedIndex = monthly.findIndex((entry) => entry.month === activeMonth)
  const summary = normalizeSummary(monthly[selectedIndex] || { month: activeMonth })
  const products = [...(productsByMonth.get(activeMonth)?.values() || [])]
  const categories = [...(categoriesByMonth.get(activeMonth) || [])].map(([category, revenue]) => ({
    category,
    revenue,
  }))

  return {
    monthly,
    selected: {
      month: activeMonth,
      summary,
      previous: selectedIndex > 0 ? monthly[selectedIndex - 1] : null,
      bestSellers: [...products].sort((a, b) => b.quantity - a.quantity),
      bestMargins: [...products].sort((a, b) => b.profit - a.profit),
      categories,
      suppliers: summary.purchases
        ? [
            {
              id: 'demo-supplier',
              name: 'Distribuidora Central',
              purchases: summary.purchases,
              paid: summary.supplierPayments,
            },
          ]
        : [],
    },
  }
}

export function StatisticsView({
  data,
  sales,
  demoMode,
  loading,
  refreshing = false,
  selectedMonth = '',
  onMonthChange,
}) {
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()))
  const statistics = useMemo(
    () => data || demoStatistics(sales, selectedMonth),
    [data, sales, selectedMonth],
  )
  const activeMonth = statistics.selected?.month || selectedMonth || CURRENT_MONTH

  if (loading) return <StatisticsSkeleton />

  const monthly = (statistics.monthly || []).map(normalizeSummary)
  const selected = statistics.selected || {}
  const summary = normalizeSummary(selected.summary || { month: activeMonth })
  const previous = selected.previous ? normalizeSummary(selected.previous) : null
  const months = buildMonthSeries(monthly, activeMonth)
  const maxChartValue = Math.max(
    1,
    ...months.flatMap((month) => [month.revenue, month.grossProfit, month.supplierPayments]),
  )
  const yMarks = [maxChartValue, maxChartValue * 0.66, maxChartValue * 0.33, 0]
  const categories = [...(selected.categories || statistics.categories || [])].sort(
    (a, b) => asNumber(b.revenue) - asNumber(a.revenue),
  )
  const categoryTotal = categories.reduce((sum, category) => sum + asNumber(category.revenue), 0)
  const selectableMonths = [...monthly].reverse()
  const years = [...new Set(selectableMonths.map((entry) => entry.month.slice(0, 4)))]
  const historyRows = selectableMonths.filter((entry) => entry.month.startsWith(historyYear))
  const ticketAverage = summary.tickets ? summary.revenue / summary.tickets : 0

  return (
    <section className="management analytics-page" aria-busy={refreshing}>
      <div className="analytics-intro">
        <div>
          <p>Historial mensual para entender ventas, costos, proveedores y rentabilidad.</p>
          {demoMode && <small className="demo-label">Datos de ejemplo</small>}
        </div>
        <label className="month-selector">
          <CalendarDays aria-hidden="true" />
          <span>Mes analizado</span>
          <select
            value={activeMonth}
            onChange={(event) => {
              setHistoryYear(event.target.value.slice(0, 4))
              onMonthChange?.(event.target.value)
            }}
            aria-label="Mes analizado"
          >
            {selectableMonths.map((entry) => (
              <option key={entry.month} value={entry.month}>
                {monthLabel(entry.month)}
              </option>
            ))}
          </select>
          {refreshing && <small role="status">Actualizando</small>}
        </label>
      </div>

      <div className="period-heading">
        <div>
          <span>Análisis mensual</span>
          <h2>{monthLabel(activeMonth)}</h2>
        </div>
        <p>Los importes contemplan devoluciones registradas.</p>
      </div>

      <div className="analytics-kpis">
        <Metric
          icon={<CircleDollarSign />}
          label="Facturación"
          value={money.format(summary.revenue)}
          detail={comparisonText(summary.revenue, previous?.revenue)}
        />
        <Metric
          icon={<TrendingUp />}
          label="Ganancia bruta"
          value={money.format(summary.grossProfit)}
          detail={`${(summary.grossMargin * 100).toFixed(1)}% de margen bruto`}
        />
        <Metric
          icon={<Truck />}
          label="Pagos a proveedores"
          value={money.format(summary.supplierPayments)}
          detail={`${money.format(summary.purchases)} en compras recibidas`}
        />
        <Metric
          icon={<ReceiptText />}
          label="Resultado tras gastos"
          value={money.format(summary.operatingResult)}
          detail={`${money.format(summary.operatingExpenses)} en gastos de caja`}
        />
        <Metric
          icon={<PackageCheck />}
          label="Unidades vendidas"
          value={number.format(summary.unitsSold)}
          detail={`${summary.tickets} ventas, ticket ${money.format(ticketAverage)}`}
        />
      </div>

      <div className="analytics-grid">
        <article className="analytics-panel wide">
          <div className="panel-title">
            <div>
              <h2>Evolución de los últimos 12 meses</h2>
              <p>Ventas, ganancia bruta y pagos realizados a proveedores.</p>
            </div>
            <div className="chart-legend" aria-label="Referencias del gráfico">
              <span>
                <i className="legend-sales" /> Ventas
              </span>
              <span>
                <i className="legend-profit" /> Ganancia
              </span>
              <span>
                <i className="legend-suppliers" /> Proveedores
              </span>
            </div>
          </div>
          <div className="chart-with-axis">
            <div className="y-axis" aria-hidden="true">
              {yMarks.map((value) => (
                <span key={value}>{money.format(value)}</span>
              ))}
            </div>
            <div className="monthly-chart" role="img" aria-label="Gráfico de evolución mensual">
              {months.map((month) => (
                <div
                  className={month.partial ? 'month-column partial' : 'month-column'}
                  key={month.month}
                >
                  <div className="bar-stack">
                    <div
                      className="revenue-bar"
                      style={{
                        height: `${Math.max(month.revenue ? 4 : 0, (month.revenue / maxChartValue) * 100)}%`,
                      }}
                      title={`Ventas ${money.format(month.revenue)}`}
                    />
                    <div
                      className="profit-bar"
                      style={{
                        height: `${Math.max(month.grossProfit ? 3 : 0, (month.grossProfit / maxChartValue) * 100)}%`,
                      }}
                      title={`Ganancia ${money.format(month.grossProfit)}`}
                    />
                    <div
                      className="supplier-bar"
                      style={{
                        height: `${Math.max(month.supplierPayments ? 3 : 0, (month.supplierPayments / maxChartValue) * 100)}%`,
                      }}
                      title={`Proveedores ${money.format(month.supplierPayments)}`}
                    />
                  </div>
                  <span>{month.label}</span>
                  {month.partial && <small>Parcial</small>}
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="analytics-panel monthly-balance">
          <div className="panel-title">
            <div>
              <h2>Resultado del mes</h2>
              <p>Lectura ordenada de ingresos y costos.</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Facturación neta</dt>
              <dd>{money.format(summary.revenue)}</dd>
            </div>
            <div>
              <dt>Costo de lo vendido</dt>
              <dd>{money.format(summary.costOfGoods)}</dd>
            </div>
            <div className="balance-highlight">
              <dt>Ganancia bruta</dt>
              <dd>{money.format(summary.grossProfit)}</dd>
            </div>
            <div>
              <dt>Gastos de caja</dt>
              <dd>{money.format(summary.operatingExpenses)}</dd>
            </div>
            <div className="balance-total">
              <dt>Resultado tras gastos</dt>
              <dd>{money.format(summary.operatingResult)}</dd>
            </div>
          </dl>
          <p className="calculation-note">
            Las compras de stock no se restan otra vez: su costo se reconoce cuando el producto se
            vende.
          </p>
        </article>

        <article className="analytics-panel">
          <div className="panel-title">
            <div>
              <h2>Gasto por proveedor</h2>
              <p>Mercadería recibida y pagos reales del mes.</p>
            </div>
          </div>
          <div className="supplier-spend-list">
            {(selected.suppliers || []).length ? (
              selected.suppliers.map((supplier) => (
                <div key={supplier.id}>
                  <strong>{supplier.name}</strong>
                  <span>
                    <small>Compras</small>
                    {money.format(asNumber(supplier.purchases))}
                  </span>
                  <span>
                    <small>Pagado</small>
                    {money.format(asNumber(supplier.paid))}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-row">No hay compras ni pagos a proveedores en este mes.</p>
            )}
          </div>
        </article>

        <Ranking
          title="Productos más vendidos"
          subtitle="Mayor cantidad despachada durante el mes."
          items={(selected.bestSellers || statistics.bestSellers || [])
            .slice(0, 5)
            .map((product) => ({
              ...product,
              detail: `${number.format(asNumber(product.quantity))} ${product.unit === 'unidad' ? 'un.' : product.unit || 'un.'}`,
              value: money.format(asNumber(product.revenue)),
            }))}
        />
        <Ranking
          title="Mayor ganancia aportada"
          subtitle="Productos que más ganancia bruta dejaron."
          items={(selected.bestMargins || statistics.bestMargins || [])
            .slice(0, 5)
            .map((product) => ({
              ...product,
              detail: `${(asNumber(product.margin) * 100).toFixed(1)}% de margen`,
              value: money.format(asNumber(product.profit)),
            }))}
        />

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
                        ? ((asNumber(category.revenue) / categoryTotal) * 100).toFixed(0)
                        : 0}
                      %
                    </span>
                  </div>
                  <span className="category-bar">
                    <i
                      style={{
                        width: `${(asNumber(category.revenue) / asNumber(categories[0].revenue || 1)) * 100}%`,
                        opacity: Math.max(0.35, 1 - index * 0.12),
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

        <article className="analytics-panel wide history-panel">
          <div className="panel-title history-title">
            <div>
              <h2>Historial mensual</h2>
              <p>Cada período queda disponible para análisis y comparación.</p>
            </div>
            <label>
              <span>Año</span>
              <select value={historyYear} onChange={(event) => setHistoryYear(event.target.value)}>
                {years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="analytics-history-wrap">
            <table className="analytics-history">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Facturación</th>
                  <th>Proveedores</th>
                  <th>Ganancia</th>
                  <th>Margen</th>
                  <th>Resultado</th>
                  <th>Producto líder</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((entry) => (
                  <tr className={entry.month === activeMonth ? 'selected' : ''} key={entry.month}>
                    <td>
                      <button type="button" onClick={() => onMonthChange?.(entry.month)}>
                        {monthLabel(entry.month, 'short')}
                      </button>
                    </td>
                    <td>{money.format(entry.revenue)}</td>
                    <td>{money.format(entry.supplierPayments)}</td>
                    <td>{money.format(entry.grossProfit)}</td>
                    <td>{(entry.grossMargin * 100).toFixed(1)}%</td>
                    <td>{money.format(entry.operatingResult)}</td>
                    <td>
                      {entry.topProductName ? (
                        <span>
                          {entry.topProductName}
                          <small>{number.format(entry.topProductQuantity)} vendidos</small>
                        </span>
                      ) : (
                        'Sin ventas'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
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

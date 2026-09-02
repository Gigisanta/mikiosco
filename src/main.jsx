import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AlertTriangle, ArrowDownToLine, BarChart3, Box, CalendarDays, Check,
  ChevronDown, CircleDollarSign, Download, FileSpreadsheet, LayoutDashboard,
  Menu, Minus, PackageCheck, PackagePlus, Plus, Search, ShoppingBag,
  TrendingUp, Upload, WalletCards,
} from 'lucide-react'
import { exportStockWorkbook, importStockWorkbook } from './excel'
import './styles.css'

const initialProducts = [
  { id: 1, barcode: '7790895001017', name: 'Coca-Cola 500 ml', category: 'Bebidas', unit: 'unidad', price: 1800, cost: 1150, stock: 24, min: 8, max: 40, sold: 73, color: '#f7d7d7', emoji: '🥤' },
  { id: 2, barcode: '7790315000446', name: 'Agua Villavicencio', category: 'Bebidas', unit: 'unidad', price: 1200, cost: 720, stock: 18, min: 6, max: 30, sold: 51, color: '#d8edf9', emoji: '💧' },
  { id: 3, barcode: '7790040122405', name: 'Alfajor triple', category: 'Golosinas', unit: 'unidad', price: 1500, cost: 830, stock: 7, min: 8, max: 32, sold: 89, color: '#f4e1c4', emoji: '🍪' },
  { id: 4, barcode: '7794520869655', name: 'Papas clásicas', category: 'Snacks', unit: 'unidad', price: 2100, cost: 1270, stock: 11, min: 6, max: 24, sold: 46, color: '#f7e5a5', emoji: '🥔' },
  { id: 5, barcode: '7792798000722', name: 'Cerveza lata', category: 'Bebidas', unit: 'unidad', price: 2200, cost: 1420, stock: 14, min: 12, max: 48, sold: 62, color: '#f9e5ad', emoji: '🍺' },
  { id: 6, barcode: '7791293050416', name: 'Chicle Beldent', category: 'Golosinas', unit: 'unidad', price: 700, cost: 330, stock: 4, min: 10, max: 50, sold: 104, color: '#dcebc5', emoji: '🍬' },
  { id: 7, barcode: '7798119220012', name: 'Energizante', category: 'Bebidas', unit: 'unidad', price: 2600, cost: 1580, stock: 9, min: 8, max: 24, sold: 37, color: '#dfd9f2', emoji: '⚡' },
  { id: 8, barcode: 'GRANEL-001', name: 'Caramelos surtidos', category: 'Golosinas', unit: 'kg', price: 8500, cost: 4800, stock: 3.5, min: 1, max: 8, sold: 12.4, color: '#e6c8ad', emoji: '🍬' },
]

const monthlyBaseline = [
  ['Oct', 684000, 263000], ['Nov', 721000, 281000], ['Dic', 896000, 361000],
  ['Ene', 748000, 292000], ['Feb', 779000, 305000], ['Mar', 842000, 329000],
  ['Abr', 824000, 316000], ['May', 907000, 354000], ['Jun', 938000, 369000],
  ['Jul', 1012000, 402000], ['Ago', 1086000, 428000], ['Sep', 84600, 33100],
]

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })
const productColors = ['#d8edf9', '#f4e1c4', '#dcebc5', '#dfd9f2', '#f7d7d7']

function loadStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback }
}

function unitStep(unit) {
  return ['kg', 'litro', 'metro'].includes(unit) ? 0.1 : unit === 'g' || unit === 'ml' ? 100 : 1
}

function unitLabel(value, unit) {
  const labels = { unidad: value === 1 ? 'unidad' : 'unidades', kg: 'kg', g: 'g', litro: value === 1 ? 'litro' : 'litros', ml: 'ml', pack: value === 1 ? 'pack' : 'packs', caja: value === 1 ? 'caja' : 'cajas', metro: value === 1 ? 'metro' : 'metros' }
  return `${number.format(value)} ${labels[unit] || unit}`
}

function stockStatus(product) {
  if (product.stock <= 0) return { label: 'Sin stock', level: 'critical' }
  if (product.stock <= product.min) return { label: 'Reponer', level: 'low' }
  if (product.max > 0 && product.stock >= product.max) return { label: 'En el máximo', level: 'high' }
  return { label: 'Stock normal', level: 'ok' }
}

function App() {
  const [section, setSection] = useState('Ventas')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('Efectivo')
  const [saleDone, setSaleDone] = useState(false)
  const [stock, setStock] = useState(() => loadStored('mikiosco-products', initialProducts))
  const [sales, setSales] = useState(() => loadStored('mikiosco-sales', []))
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const fileInput = useRef(null)

  useEffect(() => localStorage.setItem('mikiosco-products', JSON.stringify(stock)), [stock])
  useEffect(() => localStorage.setItem('mikiosco-sales', JSON.stringify(sales)), [sales])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4500)
    return () => clearTimeout(timer)
  }, [message])

  const visibleProducts = stock.filter(product => [product.name, product.category, product.barcode].some(value => String(value).toLowerCase().includes(query.toLowerCase())))
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const lowStock = stock.filter(product => product.stock <= product.min)
  const dateLabel = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date())

  const addProduct = product => {
    if (product.stock <= 0) return setMessage(`${product.name} está sin stock.`)
    setSaleDone(false)
    const step = unitStep(product.unit)
    setCart(current => {
      const found = current.find(item => item.id === product.id)
      return found
        ? current.map(item => item.id === product.id ? { ...item, qty: Math.min(product.stock, +(item.qty + step).toFixed(3)) } : item)
        : [...current, { ...product, qty: Math.min(step, product.stock) }]
    })
  }

  const changeQty = (id, direction) => setCart(current => current.flatMap(item => {
    if (item.id !== id) return [item]
    const next = +(item.qty + unitStep(item.unit) * direction).toFixed(3)
    return next <= 0 ? [] : [{ ...item, qty: Math.min(item.stock, next) }]
  }))

  const finishSale = () => {
    if (!cart.length) return
    const cost = cart.reduce((sum, item) => sum + item.cost * item.qty, 0)
    const sale = { id: crypto.randomUUID(), date: new Date().toISOString(), total, cost, payment, items: cart.map(item => ({ id: item.id, name: item.name, category: item.category, quantity: item.qty, total: item.price * item.qty, margin: (item.price - item.cost) * item.qty })) }
    setStock(current => current.map(product => {
      const item = cart.find(entry => entry.id === product.id)
      return item ? { ...product, stock: +(product.stock - item.qty).toFixed(3), sold: +(product.sold + item.qty).toFixed(3) } : product
    }))
    setSales(current => [...current, sale])
    setCart([])
    setSaleDone(true)
    setMessage(`Venta registrada por ${money.format(total)}.`)
  }

  const updateProduct = (id, patch) => setStock(current => current.map(product => product.id === id ? { ...product, ...patch } : product))

  const handleImport = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const { items, errors } = await importStockWorkbook(file)
      let created = 0
      let updated = 0
      setStock(current => {
        const next = [...current]
        items.forEach((item, index) => {
          const foundIndex = next.findIndex(product => (item.barcode && product.barcode === item.barcode) || product.name.toLowerCase() === item.name.toLowerCase())
          if (foundIndex >= 0) {
            next[foundIndex] = { ...next[foundIndex], ...item }
            updated += 1
          } else {
            next.push({ ...item, id: Date.now() + index, sold: 0, color: productColors[index % productColors.length], emoji: '📦' })
            created += 1
          }
        })
        return next
      })
      setMessage(`Excel aplicado: ${updated} actualizados, ${created} nuevos${errors.length ? `, ${errors.length} filas omitidas` : ''}.`)
    } catch (error) {
      setMessage(error.message || 'No se pudo importar el archivo.')
    } finally {
      event.target.value = ''
    }
  }

  const navItems = [
    [LayoutDashboard, 'Resumen'], [ShoppingBag, 'Ventas'], [Box, 'Productos'],
    [PackageCheck, 'Stock'], [BarChart3, 'Estadísticas'], [WalletCards, 'Caja'],
  ]

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">m</span><span>mikiosco<span className="dot">.</span>app</span></div>
      <div className="store-select"><span>Mi Kiosco</span><ChevronDown size={17}/></div>
      <nav>{navItems.map(([Icon, label]) => <button key={label} className={section === label ? 'nav-item active' : 'nav-item'} onClick={() => { setSection(label); setMenuOpen(false) }}><Icon size={19}/>{label}{label === 'Stock' && lowStock.length > 0 && <span className="nav-count">{lowStock.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="help">?</button><div><strong>Tomás</strong><span>Administrador</span></div><div className="avatar">T</div></div>
    </aside>

    <main>
      <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22}/></button><div><span className="eyebrow">{section === 'Ventas' ? 'PUNTO DE VENTA' : 'GESTIÓN DEL KIOSCO'}</span><h1>{section === 'Ventas' ? 'Nueva venta' : section}</h1></div><div className="today"><CalendarDays size={17}/> {dateLabel}</div></header>
      {message && <div className="toast"><Check size={17}/>{message}</div>}

      {section === 'Ventas' && <section className="sales-layout">
        <div className="catalog-panel">
          <div className="search"><Search size={20}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por producto, categoría o código"/><kbd>F2</kbd></div>
          <div className="category-row"><button className="chip selected" onClick={() => setQuery('')}>Todos</button>{['Bebidas', 'Golosinas', 'Snacks'].map(category => <button className="chip" key={category} onClick={() => setQuery(category)}>{category}</button>)}</div>
          <div className="product-grid">{visibleProducts.map(product => {
            const status = stockStatus(product)
            return <button className="product-card" key={product.id} onClick={() => addProduct(product)} disabled={product.stock <= 0}><div className="product-visual" style={{ background: product.color }}>{product.emoji}</div><div className="product-info"><strong>{product.name}</strong><span>{money.format(product.price)} / {product.unit}</span><small className={status.level === 'low' || status.level === 'critical' ? 'stock-low' : ''}>{unitLabel(product.stock, product.unit)} en stock</small></div><span className="add-circle"><Plus size={17}/></span></button>
          })}</div>
        </div>
        <aside className="cart-panel">
          <div className="cart-header"><div><h2>Venta actual</h2><span>{cart.length ? `${cart.length} productos` : 'Sin productos'}</span></div>{cart.length > 0 && <button className="clear" onClick={() => setCart([])}>Limpiar</button>}</div>
          <div className="cart-items">{cart.length === 0 ? <div className="empty-cart"><div><ShoppingBag size={32}/></div><strong>Tu venta está vacía</strong><span>Elegí productos para agregarlos acá.</span></div> : cart.map(item => <div className="cart-item" key={item.id}><div className="mini-emoji" style={{ background: item.color }}>{item.emoji}</div><div className="cart-name"><strong>{item.name}</strong><span>{money.format(item.price)} / {item.unit}</span></div><div className="qty"><button onClick={() => changeQty(item.id, -1)}><Minus size={14}/></button><b>{number.format(item.qty)}</b><button onClick={() => changeQty(item.id, 1)}><Plus size={14}/></button></div><strong>{money.format(item.price * item.qty)}</strong></div>)}</div>
          <div className="cart-footer"><div className="total"><span>Total</span><strong>{money.format(total)}</strong></div><div className="payment-types">{['Efectivo', 'Tarjeta', 'Transferencia'].map(type => <button key={type} onClick={() => setPayment(type)} className={payment === type ? 'payment chosen' : 'payment'}><WalletCards size={17}/>{type}</button>)}</div><button className="charge-button" disabled={!cart.length} onClick={finishSale}>{saleDone ? <><Check size={20}/> Venta registrada</> : <>Cobrar {total ? money.format(total) : ''}<span>F8</span></>}</button></div>
        </aside>
      </section>}

      {section === 'Resumen' && <Dashboard products={stock} sales={sales} onNavigate={setSection}/>}
      {section === 'Productos' && <ProductsView products={stock}/>}
      {section === 'Stock' && <StockView products={stock} updateProduct={updateProduct} onImport={() => fileInput.current?.click()} onExport={() => exportStockWorkbook(stock)}/>}
      {section === 'Estadísticas' && <StatisticsView products={stock} sales={sales}/>}
      {section === 'Caja' && <CashView sales={sales}/>}
      <input ref={fileInput} className="hidden-input" aria-label="Seleccionar archivo de stock" type="file" accept=".xlsx,.xls,.csv" onChange={handleImport}/>
    </main>
  </div>
}

function Dashboard({ products, sales, onNavigate }) {
  const low = products.filter(product => product.stock <= product.min)
  const todayRevenue = 84600 + sales.reduce((sum, sale) => sum + sale.total, 0)
  return <section className="management"><div className="metric-grid"><Metric icon={<ArrowDownToLine/>} label="Ventas de hoy" value={money.format(todayRevenue)} detail="+12% vs. ayer"/><Metric icon={<ShoppingBag/>} label="Tickets emitidos" value={String(38 + sales.length)} detail={`Promedio ${money.format(todayRevenue / (38 + sales.length))}`}/><Metric icon={<AlertTriangle/>} label="Stock bajo" value={`${low.length} productos`} detail="Revisar reposición" warning/></div><div className="notice"><AlertTriangle size={22}/><div><strong>{low.length ? `${low.length} productos necesitan reposición` : 'El stock está dentro de los límites'}</strong><span>MiKiosco compara existencias con el mínimo de cada producto.</span></div><button onClick={() => onNavigate('Stock')}>Ver stock</button></div></section>
}

function ProductsView({ products }) {
  return <section className="management"><div className="manage-header"><div><p>Catálogo de productos, precios y unidades de venta.</p></div><button className="primary"><PackagePlus size={18}/> Agregar producto</button></div><div className="inventory-list">{products.map(product => <div className="inventory-row" key={product.id}><div className="mini-emoji" style={{ background: product.color }}>{product.emoji}</div><strong>{product.name}</strong><span>{product.category}</span><b>{money.format(product.price)} / {product.unit}</b><span className={product.stock <= product.min ? 'stock-pill warning' : 'stock-pill'}>{unitLabel(product.stock, product.unit)}</span></div>)}</div></section>
}

function StockView({ products, updateProduct, onImport, onExport }) {
  const low = products.filter(product => product.stock <= product.min)
  const inventoryCost = products.reduce((sum, product) => sum + product.cost * product.stock, 0)
  const potentialMargin = products.reduce((sum, product) => sum + (product.price - product.cost) * product.stock, 0)
  return <section className="management stock-page">
    <div className="manage-header stock-header"><div><p>Actualizá el inventario desde Excel y controlá rentabilidad y reposición.</p></div><div className="header-actions"><a className="secondary-action" href="/plantilla-stock-mikiosco.xlsx" download><FileSpreadsheet size={18}/> Plantilla</a><button className="secondary-action" onClick={onImport}><Upload size={18}/> Importar Excel</button><button className="primary" onClick={onExport}><Download size={18}/> Exportar stock</button></div></div>
    <div className="stock-kpis"><Metric icon={<AlertTriangle/>} label="Para reponer" value={String(low.length)} detail="En mínimo o por debajo" warning/><Metric icon={<CircleDollarSign/>} label="Stock valorizado" value={money.format(inventoryCost)} detail="A precio de costo"/><Metric icon={<TrendingUp/>} label="Margen potencial" value={money.format(potentialMargin)} detail="Si se vende el stock actual"/></div>
    <div className="stock-table-wrap"><table className="stock-table"><thead><tr><th>Producto</th><th>Medida</th><th>Actual</th><th>Mínimo</th><th>Máximo</th><th>Costo</th><th>Venta</th><th>Margen</th><th>Estado</th></tr></thead><tbody>{products.map(product => { const status = stockStatus(product); const margin = product.price ? (product.price - product.cost) / product.price : 0; return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.category}<br/>{product.barcode}</small></td><td>{product.unit}</td><td><input aria-label={`Stock actual de ${product.name}`} type="number" step={unitStep(product.unit)} min="0" value={product.stock} onChange={event => updateProduct(product.id, { stock: Math.max(0, Number(event.target.value)) })}/></td><td><input aria-label={`Stock mínimo de ${product.name}`} type="number" step={unitStep(product.unit)} min="0" value={product.min} onChange={event => updateProduct(product.id, { min: Math.max(0, Number(event.target.value)) })}/></td><td><input aria-label={`Stock máximo de ${product.name}`} type="number" step={unitStep(product.unit)} min={product.min} value={product.max} onChange={event => updateProduct(product.id, { max: Math.max(product.min, Number(event.target.value)) })}/></td><td>{money.format(product.cost)}</td><td>{money.format(product.price)}</td><td><strong>{(margin * 100).toFixed(1)}%</strong><small>{money.format(product.price - product.cost)} / {product.unit}</small></td><td><span className={`status-badge ${status.level}`}>{status.label}</span></td></tr> })}</tbody></table></div>
    <p className="table-note">Las cantidades admiten decimales para kg, litros y metros. Cada venta descuenta automáticamente la unidad configurada.</p>
  </section>
}

function StatisticsView({ products, sales }) {
  const extraRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const extraProfit = sales.reduce((sum, sale) => sum + sale.total - sale.cost, 0)
  const months = monthlyBaseline.map((month, index) => index === 11 ? [month[0], month[1] + extraRevenue, month[2] + extraProfit] : month)
  const maxRevenue = Math.max(...months.map(month => month[1]))
  const monthRevenue = months[11][1]
  const monthProfit = months[11][2]
  const rankedSales = [...products].sort((a, b) => b.sold - a.sold)
  const rankedMargin = [...products].sort((a, b) => ((b.price - b.cost) * b.sold) - ((a.price - a.cost) * a.sold))
  const categories = Object.values(products.reduce((acc, product) => { acc[product.category] ||= { name: product.category, total: 0 }; acc[product.category].total += product.sold * product.price; return acc }, {})).sort((a, b) => b.total - a.total)
  const totalCategory = categories.reduce((sum, category) => sum + category.total, 0)
  return <section className="management analytics-page">
    <div className="analytics-intro"><p>Entendé qué vende más, dónde está tu ganancia y cómo evoluciona el negocio mes a mes.</p><span>Últimos 12 meses</span></div>
    <div className="analytics-kpis"><Metric icon={<CircleDollarSign/>} label="Facturación del mes" value={money.format(monthRevenue)} detail="Mes en curso"/><Metric icon={<TrendingUp/>} label="Ganancia bruta" value={money.format(monthProfit)} detail={`${((monthProfit / monthRevenue) * 100).toFixed(1)}% de margen`}/><Metric icon={<ShoppingBag/>} label="Ticket promedio" value={money.format(monthRevenue / Math.max(1, 38 + sales.length))} detail={`${38 + sales.length} ventas`}/><Metric icon={<PackageCheck/>} label="Unidades vendidas" value={number.format(products.reduce((sum, product) => sum + product.sold, 0))} detail="Según unidad de medida"/></div>
    <div className="analytics-grid"><article className="analytics-panel wide"><div className="panel-title"><div><h2>Ventas y ganancia mensual</h2><p>Comparación de facturación y margen bruto.</p></div><div className="chart-legend"><span><i className="legend-sales"/>Ventas</span><span><i className="legend-profit"/>Ganancia</span></div></div><div className="monthly-chart">{months.map(([label, revenue, profit]) => <div className="month-column" key={label}><div className="bar-stack"><div className="revenue-bar" style={{ height: `${Math.max(5, revenue / maxRevenue * 100)}%` }} title={`Ventas ${money.format(revenue)}`}/><div className="profit-bar" style={{ height: `${Math.max(3, profit / maxRevenue * 100)}%` }} title={`Ganancia ${money.format(profit)}`}/></div><span>{label}</span></div>)}</div></article>
      <article className="analytics-panel"><div className="panel-title"><div><h2>Participación por categoría</h2><p>Qué parte de la facturación aporta cada rubro.</p></div></div><div className="category-list">{categories.map((category, index) => <div key={category.name}><div><strong>{category.name}</strong><span>{((category.total / totalCategory) * 100).toFixed(0)}%</span></div><span className="category-bar"><i style={{ width: `${category.total / categories[0].total * 100}%`, opacity: 1 - index * .16 }}/></span></div>)}</div></article>
      <article className="analytics-panel"><div className="panel-title"><div><h2>Más vendidos</h2><p>Productos con mayor rotación.</p></div></div><div className="ranking-list">{rankedSales.slice(0, 5).map((product, index) => <div key={product.id}><span className="rank">{index + 1}</span><div><strong>{product.name}</strong><small>{unitLabel(product.sold, product.unit)} vendidos</small></div><b>{money.format(product.sold * product.price)}</b></div>)}</div></article>
      <article className="analytics-panel"><div className="panel-title"><div><h2>Mayor margen aportado</h2><p>Ganancia total estimada por producto.</p></div></div><div className="ranking-list">{rankedMargin.slice(0, 5).map((product, index) => <div key={product.id}><span className="rank">{index + 1}</span><div><strong>{product.name}</strong><small>{(((product.price - product.cost) / product.price) * 100).toFixed(1)}% por venta</small></div><b>{money.format((product.price - product.cost) * product.sold)}</b></div>)}</div></article>
    </div>
  </section>
}

function CashView({ sales }) {
  const cashSales = sales.filter(sale => sale.payment === 'Efectivo').reduce((sum, sale) => sum + sale.total, 47400)
  return <section className="management"><div className="cash-card"><div className="cash-head"><div><span className="eyebrow">CAJA ABIERTA</span><h2>Turno de hoy</h2><p>Iniciado a las 08:02 por Tomás</p></div><div className="cash-icon"><WalletCards size={32}/></div></div><div className="cash-numbers"><div><span>Fondo inicial</span><strong>{money.format(20000)}</strong></div><div><span>Ventas en efectivo</span><strong>{money.format(cashSales)}</strong></div><div><span>Dinero esperado</span><strong>{money.format(cashSales + 20000)}</strong></div></div><button className="close-cash">Hacer cierre de caja</button></div></section>
}

function Metric({ icon, label, value, detail, warning }) {
  return <article className="metric"><div className={warning ? 'metric-icon warning' : 'metric-icon'}>{icon}</div><span>{label}</span><strong>{value}</strong><small className={warning ? 'warning-text' : ''}>{detail}</small></article>
}

createRoot(document.getElementById('root')).render(<App />)
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))

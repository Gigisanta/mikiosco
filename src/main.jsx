import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, ArrowDownToLine, Box, CalendarDays, Check, ChevronDown, Clock3, CreditCard, LayoutDashboard, Menu, Minus, PackagePlus, Plus, Search, ShoppingBag, Trash2, WalletCards, X } from 'lucide-react'
import './styles.css'

const products = [
  { id: 1, name: 'Coca-Cola 500 ml', category: 'Bebidas', price: 1800, stock: 24, color: '#f7d7d7', emoji: '🥤' },
  { id: 2, name: 'Agua Villavicencio', category: 'Bebidas', price: 1200, stock: 18, color: '#d8edf9', emoji: '💧' },
  { id: 3, name: 'Alfajor triple', category: 'Golosinas', price: 1500, stock: 7, color: '#f4e1c4', emoji: '🍪' },
  { id: 4, name: 'Papas clásicas', category: 'Snacks', price: 2100, stock: 11, color: '#f7e5a5', emoji: '🥔' },
  { id: 5, name: 'Cerveza lata', category: 'Bebidas', price: 2200, stock: 14, color: '#f9e5ad', emoji: '🍺' },
  { id: 6, name: 'Chicle Beldent', category: 'Golosinas', price: 700, stock: 4, color: '#dcebc5', emoji: '🍬' },
  { id: 7, name: 'Energizante', category: 'Bebidas', price: 2600, stock: 9, color: '#dfd9f2', emoji: '⚡' },
  { id: 8, name: 'Chocolate', category: 'Golosinas', price: 1300, stock: 16, color: '#e6c8ad', emoji: '🍫' },
]

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function App() {
  const [section, setSection] = useState('Ventas')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('Efectivo')
  const [saleDone, setSaleDone] = useState(false)
  const [stock, setStock] = useState(products)
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleProducts = stock.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()))
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const lowStock = stock.filter(p => p.stock <= 7)

  const addProduct = (product) => {
    if (product.stock === 0) return
    setSaleDone(false)
    setCart(current => {
      const found = current.find(item => item.id === product.id)
      return found ? current.map(item => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, product.stock) } : item) : [...current, { ...product, qty: 1 }]
    })
  }
  const changeQty = (id, amount) => setCart(current => current.flatMap(item => item.id === id ? (item.qty + amount <= 0 ? [] : [{ ...item, qty: Math.min(item.stock, item.qty + amount) }]) : [item]))
  const finishSale = () => {
    if (!cart.length) return
    setStock(current => current.map(p => {
      const item = cart.find(c => c.id === p.id)
      return item ? { ...p, stock: p.stock - item.qty } : p
    }))
    setCart([]); setSaleDone(true)
  }

  return <div className="app-shell">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">m</span><span>mikiosco<span className="dot">.</span>app</span></div>
      <div className="store-select"><span>Mi Kiosco</span><ChevronDown size={17}/></div>
      <nav>
        {[[LayoutDashboard,'Resumen'], [ShoppingBag,'Ventas'], [Box,'Productos'], [WalletCards,'Caja']].map(([Icon, label]) => <button key={label} className={section === label ? 'nav-item active' : 'nav-item'} onClick={() => {setSection(label);setMenuOpen(false)}}><Icon size={19}/>{label}</button>)}
      </nav>
      <div className="sidebar-bottom"><button className="help">?</button><div><strong>Tomás</strong><span>Administrador</span></div><div className="avatar">T</div></div>
    </aside>
    <main>
      <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22}/></button><div><span className="eyebrow">{section === 'Ventas' ? 'PUNTO DE VENTA' : 'GESTIÓN DEL KIOSCO'}</span><h1>{section === 'Ventas' ? 'Nueva venta' : section}</h1></div><div className="today"><CalendarDays size={17}/> Hoy, 1 de septiembre</div></header>
      {section === 'Ventas' && <section className="sales-layout">
        <div className="catalog-panel">
          <div className="search"><Search size={20}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto o escanear código"/><kbd>F2</kbd></div>
          <div className="category-row"><button className="chip selected">Todos</button>{['Bebidas','Golosinas','Snacks'].map(c => <button className="chip" key={c} onClick={() => setQuery(c)}>{c}</button>)}</div>
          <div className="product-grid">{visibleProducts.map(product => <button className="product-card" key={product.id} onClick={() => addProduct(product)}><div className="product-visual" style={{background: product.color}}>{product.emoji}</div><div className="product-info"><strong>{product.name}</strong><span>{money.format(product.price)}</span><small className={product.stock <= 7 ? 'stock-low' : ''}>{product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'}</small></div><span className="add-circle"><Plus size={17}/></span></button>)}</div>
        </div>
        <aside className="cart-panel">
          <div className="cart-header"><div><h2>Venta actual</h2><span>{cart.length ? `${cart.reduce((n, i) => n + i.qty, 0)} productos` : 'Sin productos'}</span></div>{cart.length > 0 && <button className="clear" onClick={() => setCart([])}>Limpiar</button>}</div>
          <div className="cart-items">{cart.length === 0 ? <div className="empty-cart"><div><ShoppingBag size={32}/></div><strong>Tu venta está vacía</strong><span>Elegí productos para agregarlos acá.</span></div> : cart.map(item => <div className="cart-item" key={item.id}><div className="mini-emoji" style={{background:item.color}}>{item.emoji}</div><div className="cart-name"><strong>{item.name}</strong><span>{money.format(item.price)}</span></div><div className="qty"><button onClick={() => changeQty(item.id,-1)}><Minus size={14}/></button><b>{item.qty}</b><button onClick={() => changeQty(item.id,1)}><Plus size={14}/></button></div><strong>{money.format(item.price * item.qty)}</strong></div>)}</div>
          <div className="cart-footer"><div className="total"><span>Total</span><strong>{money.format(total)}</strong></div><div className="payment-types">{['Efectivo','Tarjeta','Transferencia'].map(type => <button key={type} onClick={() => setPayment(type)} className={payment === type ? 'payment chosen' : 'payment'}>{type === 'Efectivo' ? <WalletCards size={17}/> : <CreditCard size={17}/>} {type}</button>)}</div><button className="charge-button" disabled={!cart.length} onClick={finishSale}>{saleDone ? <><Check size={20}/> Venta registrada</> : <>Cobrar {total ? money.format(total) : ''}<span>F8</span></>}</button></div>
        </aside>
      </section>}
      {section !== 'Ventas' && <section className="management">
        {section === 'Resumen' ? <><div className="metric-grid"><Metric icon={<ArrowDownToLine/>} label="Ventas de hoy" value="$ 84.600" detail="+12% vs. ayer"/><Metric icon={<ShoppingBag/>} label="Tickets emitidos" value="38" detail="Promedio $2.226"/><Metric icon={<AlertTriangle/>} label="Stock bajo" value={`${lowStock.length} productos`} detail="Revisar ahora" warning/></div><div className="notice"><Clock3 size={22}/><div><strong>Tu caja está abierta desde las 08:02</strong><span>Llevás $84.600 vendidos en el día.</span></div><button onClick={() => setSection('Caja')}>Ver caja</button></div></> : section === 'Productos' ? <><div className="manage-header"><div><p>Controlá precios y stock sin vueltas.</p></div><button className="primary"><PackagePlus size={18}/> Agregar producto</button></div><div className="inventory-list">{stock.map(p => <div className="inventory-row" key={p.id}><div className="mini-emoji" style={{background:p.color}}>{p.emoji}</div><strong>{p.name}</strong><span>{p.category}</span><b>{money.format(p.price)}</b><span className={p.stock <= 7 ? 'stock-pill warning' : 'stock-pill'}>{p.stock} unidades</span></div>)}</div></> : <><div className="cash-card"><div className="cash-head"><div><span className="eyebrow">CAJA ABIERTA</span><h2>Turno de hoy</h2><p>Iniciado a las 08:02 por Tomás</p></div><div className="cash-icon"><WalletCards size={32}/></div></div><div className="cash-numbers"><div><span>Fondo inicial</span><strong>$ 20.000</strong></div><div><span>Ventas en efectivo</span><strong>$ 47.400</strong></div><div><span>Dinero esperado</span><strong>$ 67.400</strong></div></div><button className="close-cash">Hacer cierre de caja</button></div></>}
      </section>}
    </main>
  </div>
}

function Metric({icon,label,value,detail,warning}) { return <article className="metric"><div className={warning ? 'metric-icon warning' : 'metric-icon'}>{icon}</div><span>{label}</span><strong>{value}</strong><small className={warning ? 'warning-text' : ''}>{detail}</small></article> }

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))

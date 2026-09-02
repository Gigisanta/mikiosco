import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { Topbar } from './components/Topbar'
import { DEMO_PRODUCTS, PRODUCT_COLORS } from './data/demoData'
import { exportStockWorkbook, importStockWorkbook } from './excel'
import { useVersionedStorage } from './hooks/useVersionedStorage'
import { formatDateLabel, money } from './lib/format'
import { roundQuantity, unitStep } from './lib/inventory'
import { CashView } from './views/CashView'
import { DashboardView } from './views/DashboardView'
import { ProductsView } from './views/ProductsView'
import { SalesView } from './views/SalesView'
import { StatisticsView } from './views/StatisticsView'
import { StockView } from './views/StockView'

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function App() {
  const [section, setSection] = useState('Ventas')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('Efectivo')
  const [saleDone, setSaleDone] = useState(false)
  const [products, setProducts] = useVersionedStorage('mikiosco-products', DEMO_PRODUCTS)
  const [sales, setSales] = useVersionedStorage('mikiosco-sales', [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(null), 4500)
    return () => window.clearTimeout(timer)
  }, [message])

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const lowStock = products.filter((product) => product.stock <= product.min)

  function notify(text, type = 'success') {
    setMessage({ text, type })
  }

  function addProduct(product) {
    if (product.stock <= 0) {
      notify(`${product.name} está sin stock.`, 'error')
      return
    }
    setSaleDone(false)
    setCart((current) => {
      const found = current.find((item) => item.id === product.id)
      if (!found) {
        return [...current, { ...product, qty: Math.min(unitStep(product.unit), product.stock) }]
      }
      return current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              qty: Math.min(product.stock, roundQuantity(item.qty + unitStep(item.unit))),
            }
          : item,
      )
    })
  }

  function changeQuantity(id, direction) {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.id !== id) return [item]
        const next = roundQuantity(item.qty + unitStep(item.unit) * direction)
        return next <= 0 ? [] : [{ ...item, qty: Math.min(item.stock, next) }]
      }),
    )
  }

  function clearCart() {
    if (window.confirm('¿Querés limpiar todos los productos de la venta?')) setCart([])
  }

  function finishSale() {
    if (!cart.length) return
    const cost = cart.reduce((sum, item) => sum + item.cost * item.qty, 0)
    const sale = {
      id: createId(),
      date: new Date().toISOString(),
      total,
      cost,
      payment,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.qty,
        total: item.price * item.qty,
        margin: (item.price - item.cost) * item.qty,
      })),
    }
    setProducts((current) =>
      current.map((product) => {
        const item = cart.find((entry) => entry.id === product.id)
        return item
          ? {
              ...product,
              stock: roundQuantity(product.stock - item.qty),
              sold: roundQuantity(product.sold + item.qty),
            }
          : product
      }),
    )
    setSales((current) => [...current, sale])
    setCart([])
    setSaleDone(true)
    notify(`Venta registrada por ${money.format(total)}.`)
  }

  function updateProduct(id, patch) {
    setProducts((current) =>
      current.map((product) => (product.id === id ? { ...product, ...patch } : product)),
    )
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const { items, errors } = await importStockWorkbook(file)
      let created = 0
      let updated = 0
      setProducts((current) => {
        const next = [...current]
        items.forEach((item, index) => {
          const foundIndex = next.findIndex(
            (product) =>
              (item.barcode && product.barcode === item.barcode) ||
              product.name.toLowerCase() === item.name.toLowerCase(),
          )
          if (foundIndex >= 0) {
            next[foundIndex] = { ...next[foundIndex], ...item }
            updated += 1
          } else {
            next.push({
              ...item,
              id: Date.now() + index,
              sold: 0,
              color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
              emoji: '📦',
            })
            created += 1
          }
        })
        return next
      })
      const omitted = errors.length ? ` Se omitieron ${errors.length} filas.` : ''
      notify(`Excel aplicado: ${updated} actualizados y ${created} nuevos.${omitted}`)
    } catch (error) {
      notify(error.message || 'No se pudo importar el archivo.', 'error')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <Sidebar
        section={section}
        setSection={setSection}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        lowStockCount={lowStock.length}
      />
      <main id="main-content">
        <Topbar
          section={section}
          dateLabel={formatDateLabel()}
          onMenu={() => setMenuOpen((current) => !current)}
        />
        <Toast message={message} />
        {section === 'Ventas' && (
          <SalesView
            products={products}
            query={query}
            setQuery={setQuery}
            cart={cart}
            payment={payment}
            setPayment={setPayment}
            total={total}
            saleDone={saleDone}
            addProduct={addProduct}
            changeQuantity={changeQuantity}
            clearCart={clearCart}
            finishSale={finishSale}
          />
        )}
        {section === 'Resumen' && (
          <DashboardView products={products} sales={sales} onNavigate={setSection} />
        )}
        {section === 'Productos' && <ProductsView products={products} />}
        {section === 'Stock' && (
          <StockView
            products={products}
            updateProduct={updateProduct}
            onImport={() => fileInput.current?.click()}
            onExport={() => exportStockWorkbook(products)}
          />
        )}
        {section === 'Estadísticas' && <StatisticsView products={products} sales={sales} />}
        {section === 'Caja' && <CashView sales={sales} />}
        <input
          ref={fileInput}
          className="hidden-input"
          aria-label="Seleccionar archivo de stock"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleImport}
        />
      </main>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { Topbar } from './components/Topbar'
import { DEMO_PRODUCTS, PRODUCT_COLORS } from './data/demoData'
import { exportStockWorkbook, importStockWorkbook } from './excel'
import { useVersionedStorage } from './hooks/useVersionedStorage'
import { apiProductToUi, authApi, businessApi } from './lib/api'
import { formatDateLabel, money } from './lib/format'
import { roundQuantity, unitStep } from './lib/inventory'
import { enqueueSale, readPendingSales, syncPendingSales } from './lib/offlineQueue'
import { CashView } from './views/CashView'
import { DashboardView } from './views/DashboardView'
import { LoginView } from './views/LoginView'
import { ProductsView } from './views/ProductsView'
import { SalesView } from './views/SalesView'
import { StatisticsView } from './views/StatisticsView'
import { StockView } from './views/StockView'

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'
const demoSession = {
  user: { id: 'demo', name: 'Tomás', role: 'ADMIN' },
  branch: { id: 'demo', name: 'Mi Kiosco' },
}

export default function App() {
  const [section, setSection] = useState('Ventas')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState([])
  const [payment, setPayment] = useState('Efectivo')
  const [saleDone, setSaleDone] = useState(false)
  const [products, setProducts] = useVersionedStorage(
    'mikiosco-products',
    DEMO_MODE ? DEMO_PRODUCTS : [],
  )
  const [sales, setSales] = useVersionedStorage('mikiosco-sales', [])
  const [session, setSession] = useState(DEMO_MODE ? demoSession : null)
  const [authReady, setAuthReady] = useState(DEMO_MODE)
  const [cashSession, setCashSession] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => readPendingSales().length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)

  const loadServerData = useCallback(async () => {
    try {
      const [productsResult, salesResult, cashResult] = await Promise.all([
        businessApi.products(),
        businessApi.sales(),
        businessApi.cashSession(),
      ])
      setProducts(productsResult.items.map(apiProductToUi))
      setSales(
        salesResult.items.map((sale) => ({
          ...sale,
          date: sale.createdAt,
          cost: sale.items.reduce(
            (sum, item) => sum + Number(item.unitCost) * Number(item.quantity),
            0,
          ),
          payment: 'Servidor',
        })),
      )
      setCashSession(cashResult.session)
    } catch (error) {
      if (error.status === 401) setSession(null)
      else setMessage({ text: error.message, type: 'error' })
    }
  }, [setProducts, setSales])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(null), 4500)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (DEMO_MODE) return undefined
    authApi
      .me()
      .then((result) => {
        setSession({
          user: result.user,
          branch: { id: result.user.branchId, name: result.user.branchName },
        })
      })
      .catch(() => setSession(null))
      .finally(() => setAuthReady(true))
    return undefined
  }, [])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (DEMO_MODE || !session) return undefined
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadServerData()
    })
    return () => controller.abort()
  }, [loadServerData, session])

  useEffect(() => {
    if (DEMO_MODE || !session || !online || !pendingCount) return undefined
    async function synchronize() {
      setSyncing(true)
      const result = await syncPendingSales(businessApi.createSale)
      setPendingCount(result.pending)
      setSyncing(false)
      if (!result.error) await loadServerData()
    }
    void synchronize()
    return undefined
  }, [loadServerData, online, pendingCount, session])

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart])
  const lowStock = products.filter((product) => product.stock <= product.min)

  function notify(text, type = 'success') {
    setMessage({ text, type })
  }

  function handleLogin(result) {
    setSession({ user: result.user, branch: result.branch })
  }

  async function handleLogout() {
    try {
      await authApi.logout()
    } finally {
      setSession(null)
      setProducts([])
      setSales([])
      setCart([])
    }
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

  async function finishSale() {
    if (!cart.length) return
    const cost = cart.reduce((sum, item) => sum + item.cost * item.qty, 0)
    const localSale = {
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
    if (!DEMO_MODE) {
      if (!cashSession) {
        notify('Abrí una caja antes de cobrar.', 'error')
        return
      }
      const payload = {
        idempotencyKey: createId(),
        cashSessionId: cashSession.id,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.qty,
          unitPrice: item.price,
        })),
        payments: [
          {
            method: { Efectivo: 'CASH', Tarjeta: 'CARD', Transferencia: 'TRANSFER' }[payment],
            amount: total,
          },
        ],
      }
      if (!online) {
        const queue = enqueueSale(payload)
        setPendingCount(queue.length)
      } else {
        try {
          await businessApi.createSale(payload)
        } catch (error) {
          if (error.status) {
            notify(error.message, 'error')
            return
          }
          const queue = enqueueSale(payload)
          setPendingCount(queue.length)
          setOnline(false)
        }
      }
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
    setSales((current) => [...current, localSale])
    setCart([])
    setSaleDone(true)
    notify(`Venta registrada por ${money.format(total)}.`)
    if (!DEMO_MODE && online) void loadServerData()
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

  if (!authReady) {
    return (
      <main className="login-page">
        <div className="loading-card">Preparando tu kiosco…</div>
      </main>
    )
  }
  if (!session) return <LoginView onLogin={handleLogin} />

  const connection = DEMO_MODE
    ? { type: 'demo', label: 'Modo demostración' }
    : syncing
      ? { type: 'syncing', label: 'Sincronizando…' }
      : online
        ? { type: 'online', label: 'En línea' }
        : { type: 'offline', label: `Sin conexión · ${pendingCount} en cola` }

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
        role={session.user.role}
        user={session.user}
        branch={session.branch}
        onLogout={DEMO_MODE ? null : handleLogout}
      />
      <main id="main-content">
        <Topbar
          section={section}
          dateLabel={formatDateLabel()}
          onMenu={() => setMenuOpen((current) => !current)}
          connection={connection}
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
            canSell={session.user.role !== 'VIEWER'}
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

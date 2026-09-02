import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { Topbar } from './components/Topbar'
import { createDemoSales, DEMO_CUSTOMERS, DEMO_PRODUCTS, DEMO_SUPPLIERS } from './data/demoData'
import { exportStockWorkbook, importStockWorkbook } from './excel'
import { useVersionedStorage } from './hooks/useVersionedStorage'
import { apiProductToUi, authApi, businessApi } from './lib/api'
import { createDemoBackup, downloadBackup } from './lib/backup'
import { formatDateLabel, money } from './lib/format'
import { roundQuantity, unitStep } from './lib/inventory'
import { enqueueSale, readPendingSales, syncPendingSales } from './lib/offlineQueue'
import { CashView } from './views/CashView'
import { CustomersView } from './views/CustomersView'
import { DashboardView } from './views/DashboardView'
import { LoginView } from './views/LoginView'
import { ProductsView } from './views/ProductsView'
import { SalesView } from './views/SalesView'
import { StatisticsView } from './views/StatisticsView'
import { StockView } from './views/StockView'
import { SuppliersView } from './views/SuppliersView'

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
  const [saleDone, setSaleDone] = useState(null)
  const [products, setProducts] = useVersionedStorage(
    'mikiosco-products',
    DEMO_MODE ? DEMO_PRODUCTS : [],
  )
  const [sales, setSales] = useVersionedStorage(
    'mikiosco-sales',
    DEMO_MODE ? createDemoSales() : [],
  )
  const [customers, setCustomers] = useVersionedStorage(
    'mikiosco-customers',
    DEMO_MODE ? DEMO_CUSTOMERS : [],
  )
  const [suppliers, setSuppliers] = useVersionedStorage(
    'mikiosco-suppliers',
    DEMO_MODE ? DEMO_SUPPLIERS : [],
  )
  const [session, setSession] = useState(DEMO_MODE ? demoSession : null)
  const [authReady, setAuthReady] = useState(DEMO_MODE)
  const [cashSession, setCashSession] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => readPendingSales().length)
  const [statisticsData, setStatisticsData] = useState(null)
  const [importErrors, setImportErrors] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)

  const loadServerData = useCallback(async () => {
    try {
      const [productsResult, salesResult, cashResult, customersResult, suppliersResult] =
        await Promise.all([
          businessApi.products(),
          businessApi.sales(),
          businessApi.cashSession(),
          businessApi.customers(),
          businessApi.suppliers(),
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
      setCustomers(
        customersResult.items.map((customer) => ({
          ...customer,
          balance: Number(customer.balance),
          creditLimit: Number(customer.creditLimit),
        })),
      )
      setSuppliers(
        suppliersResult.items.map((supplier) => ({
          ...supplier,
          currentDebt: Number(supplier.currentDebt),
        })),
      )
    } catch (error) {
      if (error.status === 401) setSession(null)
      else setMessage({ text: error.message, type: 'error' })
    }
  }, [setCustomers, setProducts, setSales, setSuppliers])

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
        if (!result.user) {
          setSession(null)
          return
        }
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
    if (DEMO_MODE || !session || !online) return undefined
    const refresh = () => {
      if (document.visibilityState === 'visible' && !syncing) void loadServerData()
    }
    const timer = window.setInterval(refresh, 12000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadServerData, online, session, syncing])

  useEffect(() => {
    if (DEMO_MODE || !session || !online || !pendingCount) return undefined
    async function synchronize() {
      setSyncing(true)
      const result = await syncPendingSales(businessApi.createSale)
      setPendingCount(result.pending)
      setSyncing(false)
      if (!result.error) await loadServerData()
      else {
        setMessage({
          text: `Quedaron ${result.pending} ventas pendientes. ${result.error.message}`,
          type: 'error',
        })
      }
    }
    void synchronize()
    return undefined
  }, [loadServerData, online, pendingCount, session])

  useEffect(() => {
    if (DEMO_MODE || section !== 'Estadísticas' || session?.user.role === 'CASHIER') {
      return undefined
    }
    let active = true
    businessApi
      .statistics()
      .then((result) => {
        if (active) setStatisticsData(result)
      })
      .catch((error) => {
        if (active) setMessage({ text: error.message, type: 'error' })
      })
    return () => {
      active = false
    }
  }, [section, session?.user.role])

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * Number(item.qty || 0), 0),
    [cart],
  )
  const lowStock = products.filter((product) => product.stock <= product.min)

  useEffect(() => {
    if (!DEMO_MODE || !session) return undefined
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('mikiosco-auto-backup-date') === today) return undefined
    const timer = window.setTimeout(() => {
      localStorage.setItem(
        'mikiosco-auto-backup',
        JSON.stringify(createDemoBackup({ products, sales, customers, suppliers })),
      )
      localStorage.setItem('mikiosco-auto-backup-date', today)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [customers, products, sales, session, suppliers])

  function notify(text, type = 'success') {
    setMessage({ text, type })
  }

  async function exportBackup() {
    try {
      const backup = DEMO_MODE
        ? createDemoBackup({ products, sales, customers, suppliers })
        : await businessApi.backup()
      downloadBackup(backup)
      notify('Respaldo completo descargado.')
    } catch (error) {
      notify(error.message || 'No se pudo generar el respaldo.', 'error')
    }
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
      setCustomers([])
      setSuppliers([])
      setStatisticsData(null)
      setCart([])
    }
  }

  async function openCash(openingAmount) {
    const result = await businessApi.openCashSession(openingAmount)
    setCashSession({ ...result.session, openedBy: session.user.name })
    notify('Caja abierta. Ya podés registrar ventas.')
  }

  async function closeCash(id, closingAmount) {
    const result = await businessApi.closeCashSession(id, closingAmount)
    setCashSession(null)
    const difference = Number(result.session.difference)
    notify(
      difference === 0
        ? 'Caja cerrada sin diferencias.'
        : `Caja cerrada con una diferencia de ${money.format(difference)}.`,
      difference === 0 ? 'success' : 'warning',
    )
  }

  async function createExpense(expense) {
    const result = await businessApi.createExpense(expense)
    notify('Movimiento de caja registrado.')
    return result.item
  }

  async function voidSale(sale) {
    if (!window.confirm('¿Querés anular esta venta y devolver sus productos al stock?')) return
    if (DEMO_MODE) {
      setProducts((current) =>
        current.map((product) => {
          const item = sale.items.find((entry) => (entry.productId || entry.id) === product.id)
          return item
            ? {
                ...product,
                stock: roundQuantity(product.stock + Number(item.quantity)),
                sold: Math.max(0, roundQuantity(product.sold - Number(item.quantity))),
              }
            : product
        }),
      )
      setSales((current) =>
        current.map((entry) => (entry.id === sale.id ? { ...entry, status: 'VOIDED' } : entry)),
      )
    } else {
      await businessApi.voidSale(sale.id)
      await loadServerData()
    }
    notify('Venta anulada. El stock fue repuesto.')
  }

  async function returnSaleItem(sale, item, quantity, refundMethod) {
    if (DEMO_MODE) {
      const productId = item.productId || item.id
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                stock: roundQuantity(product.stock + quantity),
                sold: Math.max(0, roundQuantity(product.sold - quantity)),
              }
            : product,
        ),
      )
      setSales((current) =>
        current.map((entry) =>
          entry.id === sale.id
            ? {
                ...entry,
                items: entry.items.map((saleItem) =>
                  saleItem.id === item.id
                    ? {
                        ...saleItem,
                        returnedQuantity: roundQuantity(
                          Number(saleItem.returnedQuantity || 0) + quantity,
                        ),
                      }
                    : saleItem,
                ),
              }
            : entry,
        ),
      )
    } else {
      await businessApi.returnItems(sale.id, [{ saleItemId: item.id, quantity }], refundMethod)
      await loadServerData()
    }
    notify('Devolución registrada. El producto volvió al stock.')
  }

  async function createCustomer(customer) {
    let item
    if (DEMO_MODE) {
      item = {
        ...customer,
        id: createId(),
        balance: 0,
        purchaseCount: 0,
      }
    } else {
      const result = await businessApi.createCustomer(customer)
      item = { ...result.item, balance: Number(result.item.balance) }
    }
    setCustomers((current) => [...current, item])
    notify('Cliente guardado.')
    return item
  }

  async function payCustomer(customer, amount) {
    if (!DEMO_MODE) {
      await businessApi.payCustomerAccount(customer.id, {
        amount,
        method: 'CASH',
        cashSessionId: cashSession?.id || null,
      })
    }
    setCustomers((current) =>
      current.map((item) =>
        item.id === customer.id ? { ...item, balance: Math.max(0, item.balance - amount) } : item,
      ),
    )
    if (!DEMO_MODE) await loadServerData()
    notify('Cobro registrado en la cuenta del cliente.')
  }

  async function saveProduct(form) {
    const payload = {
      ...form,
      costPrice: Number(form.costPrice || 0),
      salePrice: Number(form.salePrice),
      stock: Number(form.stock || 0),
      minStock: Number(form.minStock || 0),
      maxStock: Number(form.maxStock || 0),
      supplierId: form.supplierId || null,
    }
    if (DEMO_MODE) {
      const mapped = {
        id: payload.id || createId(),
        name: payload.name,
        barcode: payload.barcode,
        category: payload.categoryName || 'Sin categoría',
        categoryId: payload.categoryId,
        supplierId: payload.supplierId,
        unit: payload.unit,
        cost: payload.costPrice,
        price: payload.salePrice,
        stock: payload.stock,
        min: payload.minStock,
        max: payload.maxStock,
        sold: 0,
      }
      setProducts((current) =>
        payload.id
          ? current.map((product) =>
              product.id === payload.id ? { ...product, ...mapped } : product,
            )
          : [...current, mapped],
      )
    } else {
      if (payload.id) await businessApi.updateProduct(payload)
      else await businessApi.createProduct(payload)
      await loadServerData()
    }
    notify(payload.id ? 'Producto actualizado.' : 'Producto creado.')
  }

  async function deleteProduct(product) {
    if (!window.confirm(`¿Querés dar de baja ${product.name}?`)) return
    if (!DEMO_MODE) await businessApi.deleteProduct(product.id)
    setProducts((current) => current.filter((item) => item.id !== product.id))
    notify('Producto dado de baja.')
  }

  async function updatePrices(change) {
    if (!DEMO_MODE) {
      await businessApi.updatePrices(change)
      await loadServerData()
    } else {
      setProducts((current) =>
        current.map((product) => {
          const applies =
            change.scope === 'all' ||
            (change.scope === 'category' && product.category === change.categoryName) ||
            (change.scope === 'selected' && change.productIds.includes(product.id))
          if (!applies) return product
          const raw = product.price * (1 + change.percentage / 100)
          const price = change.rounding
            ? Math.ceil(raw / change.rounding) * change.rounding
            : Math.round(raw * 100) / 100
          return { ...product, price }
        }),
      )
    }
    notify('Precios actualizados.')
  }

  async function createSupplier(supplier) {
    const item = DEMO_MODE
      ? { ...supplier, id: createId(), currentDebt: 0 }
      : (await businessApi.createSupplier(supplier)).item
    setSuppliers((current) => [...current, item])
    notify('Proveedor guardado.')
  }

  async function createPurchase(purchase) {
    if (!DEMO_MODE) {
      await businessApi.createPurchase(purchase)
      await loadServerData()
    } else {
      const line = purchase.items[0]
      setProducts((current) =>
        current.map((product) =>
          String(product.id) === String(line.productId)
            ? {
                ...product,
                stock: roundQuantity(product.stock + line.quantity),
                cost: line.unitCost,
              }
            : product,
        ),
      )
      const debt = line.quantity * line.unitCost - purchase.paidAmount
      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === purchase.supplierId
            ? { ...supplier, currentDebt: Number(supplier.currentDebt) + debt }
            : supplier,
        ),
      )
    }
    notify('Ingreso de mercadería registrado.')
  }

  async function paySupplier(supplierId, amount, method) {
    if (!DEMO_MODE) {
      await businessApi.paySupplier(supplierId, {
        amount,
        method,
        cashSessionId: method === 'CASH' ? cashSession?.id || null : null,
      })
      await loadServerData()
    } else {
      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.id === supplierId
            ? { ...supplier, currentDebt: Math.max(0, Number(supplier.currentDebt) - amount) }
            : supplier,
        ),
      )
    }
    notify('Pago al proveedor registrado.')
  }

  async function saveStockProduct(product) {
    if (!DEMO_MODE) {
      await businessApi.updateProduct({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        categoryId: product.categoryId,
        categoryName: product.category,
        supplierId: product.supplierId,
        unit: product.unit,
        costPrice: product.cost,
        salePrice: product.price,
        stock: product.stock,
        minStock: product.min,
        maxStock: product.max,
      })
      await loadServerData()
    }
    notify('Límites y stock actualizados.')
  }

  function addProduct(product, requestedQuantity) {
    if (product.stock <= 0) {
      notify(`${product.name} está sin stock.`, 'error')
      return
    }
    setSaleDone(null)
    const quantity = Math.max(
      unitStep(product.unit),
      roundQuantity(Number(requestedQuantity) || unitStep(product.unit)),
    )
    setCart((current) => {
      const found = current.find((item) => item.id === product.id)
      if (!found) {
        return [...current, { ...product, qty: Math.min(quantity, product.stock) }]
      }
      return current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              qty: Math.min(product.stock, roundQuantity(Number(item.qty || 0) + quantity)),
            }
          : item,
      )
    })
  }

  function changeQuantity(id, direction) {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.id !== id) return [item]
        const next = roundQuantity(Number(item.qty || 0) + unitStep(item.unit) * direction)
        return next <= 0 ? [] : [{ ...item, qty: Math.min(item.stock, next) }]
      }),
    )
  }

  function setQuantity(id, value) {
    setCart((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        if (value === '') return { ...item, qty: '' }
        const parsed = Number(String(value).replace(',', '.'))
        return Number.isFinite(parsed)
          ? { ...item, qty: Math.min(item.stock, Math.max(0, roundQuantity(parsed))) }
          : item
      }),
    )
  }

  function removeItem(id) {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  function clearCart() {
    if (window.confirm('¿Querés limpiar todos los productos de la venta?')) setCart([])
  }

  async function finishSale(checkout) {
    if (!cart.length) return false
    if (cart.some((item) => Number(item.qty) <= 0)) {
      notify('Revisá las cantidades antes de cobrar.', 'error')
      return false
    }
    const cost = cart.reduce((sum, item) => sum + item.cost * Number(item.qty), 0)
    const localSale = {
      id: createId(),
      date: new Date().toISOString(),
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      total: checkout.total,
      cost,
      payment: checkout.payments.map((entry) => entry.method).join(' + '),
      payments: checkout.payments,
      cashReceived: checkout.cashReceived,
      change: checkout.change,
      customerId: checkout.customerId,
      customerName: customers.find((customer) => customer.id === checkout.customerId)?.name,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.qty,
        total: item.price * Number(item.qty),
        margin: (item.price - item.cost) * Number(item.qty),
      })),
    }
    if (!DEMO_MODE) {
      if (!cashSession) {
        notify('Abrí una caja antes de cobrar.', 'error')
        return false
      }
      const payload = {
        idempotencyKey: createId(),
        cashSessionId: cashSession.id,
        customerId: checkout.customerId,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.qty,
          unitPrice: item.price,
        })),
        discount: checkout.discount,
        payments: checkout.payments,
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
            return false
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
              stock: roundQuantity(product.stock - Number(item.qty)),
              sold: roundQuantity(product.sold + Number(item.qty)),
            }
          : product
      }),
    )
    setSales((current) => [...current, localSale])
    const accountAmount = checkout.payments
      .filter((entry) => entry.method === 'ACCOUNT')
      .reduce((sum, entry) => sum + entry.amount, 0)
    if (DEMO_MODE && checkout.customerId && accountAmount) {
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === checkout.customerId
            ? {
                ...customer,
                balance: Number(customer.balance) + accountAmount,
                purchaseCount: Number(customer.purchaseCount || 0) + 1,
              }
            : customer,
        ),
      )
    }
    setCart([])
    setSaleDone(localSale)
    notify(`Venta registrada por ${money.format(checkout.total)}.`)
    if (!DEMO_MODE && online) void loadServerData()
    return true
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
      setImportErrors(errors)
      if (!DEMO_MODE) {
        const result = await businessApi.updateStock(
          items.map((item) => ({
            barcode: item.barcode,
            name: item.name,
            unit: item.unit,
            stock: item.stock,
            minStock: item.min,
            maxStock: item.max,
            costPrice: item.cost,
            salePrice: item.price,
          })),
        )
        await loadServerData()
        const omitted = errors.length ? ` Se omitieron ${errors.length} filas.` : ''
        notify(
          `Excel aplicado: ${result.updated} actualizados y ${result.created} nuevos.${omitted}`,
        )
        return
      }
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
            })
            created += 1
          }
        })
        return next
      })
      const omitted = errors.length ? ` Se omitieron ${errors.length} filas.` : ''
      notify(`Excel aplicado: ${updated} actualizados y ${created} nuevos.${omitted}`)
    } catch (error) {
      setImportErrors([error.message || 'No se pudo leer el archivo seleccionado.'])
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
        ? pendingCount
          ? { type: 'warning', label: `En línea · ${pendingCount} pendientes` }
          : { type: 'online', label: 'En línea' }
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
            customers={customers}
            query={query}
            setQuery={setQuery}
            cart={cart}
            total={total}
            saleDone={saleDone}
            addProduct={addProduct}
            setQuantity={setQuantity}
            removeItem={removeItem}
            changeQuantity={changeQuantity}
            clearCart={clearCart}
            finishSale={finishSale}
            onCreateCustomer={createCustomer}
            canSell={session.user.role !== 'VIEWER'}
          />
        )}
        {section === 'Resumen' && (
          <DashboardView
            products={products}
            sales={sales}
            onNavigate={setSection}
            demoMode={DEMO_MODE}
            cashSession={cashSession}
            onBackup={exportBackup}
          />
        )}
        {section === 'Productos' && (
          <ProductsView
            products={products}
            suppliers={suppliers}
            canEdit={session.user.role === 'ADMIN'}
            demoMode={DEMO_MODE}
            onSave={saveProduct}
            onDelete={deleteProduct}
            onBulk={updatePrices}
          />
        )}
        {section === 'Stock' && (
          <StockView
            products={products}
            updateProduct={updateProduct}
            onSave={saveStockProduct}
            onImport={() => fileInput.current?.click()}
            onExport={() => exportStockWorkbook(products)}
            canEdit={session.user.role !== 'VIEWER'}
            importErrors={importErrors}
          />
        )}
        {section === 'Estadísticas' && (
          <StatisticsView
            data={statisticsData}
            sales={sales}
            demoMode={DEMO_MODE}
            loading={!DEMO_MODE && !statisticsData}
          />
        )}
        {section === 'Clientes' && (
          <CustomersView
            customers={customers}
            demoMode={DEMO_MODE}
            canEdit={session.user.role !== 'VIEWER'}
            onCreate={createCustomer}
            onPay={payCustomer}
          />
        )}
        {section === 'Proveedores' && (
          <SuppliersView
            suppliers={suppliers}
            products={products}
            demoMode={DEMO_MODE}
            canEdit={session.user.role === 'ADMIN'}
            onCreate={createSupplier}
            onPurchase={createPurchase}
            onPay={paySupplier}
          />
        )}
        {section === 'Caja' && (
          <CashView
            sales={sales}
            cashSession={cashSession}
            demoMode={DEMO_MODE}
            canOperate={session.user.role !== 'VIEWER'}
            canVoid={session.user.role === 'ADMIN'}
            onOpen={openCash}
            onClose={closeCash}
            onExpense={createExpense}
            onVoid={voidSale}
            onReturn={returnSaleItem}
          />
        )}
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

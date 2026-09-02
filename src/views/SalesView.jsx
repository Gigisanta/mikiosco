import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Minus, Plus, Printer, Search, ShoppingBag, Split, WalletCards } from 'lucide-react'
import { money, number } from '../lib/format'
import { stockStatus, unitLabel, unitStep } from '../lib/inventory'
import { calculateChange, closestTender, normalizeMoney, parseScannerQuery } from '../lib/pos'

const paymentMethods = [
  ['CASH', 'Efectivo'],
  ['CARD', 'Tarjeta'],
  ['TRANSFER', 'Transferencia'],
]

export function SalesView({
  products,
  query,
  setQuery,
  cart,
  total,
  saleDone,
  addProduct,
  setQuantity,
  removeItem,
  changeQuantity,
  clearCart,
  finishSale,
  canSell,
}) {
  const [method, setMethod] = useState('CASH')
  const [splitPayment, setSplitPayment] = useState(false)
  const [amounts, setAmounts] = useState({ CASH: '', CARD: '', TRANSFER: '' })
  const [cashReceived, setCashReceived] = useState('')
  const [discount, setDiscount] = useState('')
  const [scanQuantity, setScanQuantity] = useState('1')
  const [ticketWidth, setTicketWidth] = useState('80')
  const [selectedId, setSelectedId] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const searchRef = useRef(null)
  const discountRef = useRef(null)
  const firstProductRef = useRef(null)

  const categories = [...new Set(products.map((product) => product.category))].sort()
  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        [product.name, product.category, product.barcode].some((value) =>
          String(value).toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [products, query],
  )
  const safeDiscount = Math.min(total, normalizeMoney(discount))
  const amountDue = normalizeMoney(total - safeDiscount)
  const cashApplied = splitPayment
    ? normalizeMoney(amounts.CASH)
    : method === 'CASH'
      ? amountDue
      : 0
  const change = calculateChange(cashReceived || cashApplied, cashApplied)

  useEffect(() => {
    function handleKeyboard(event) {
      if (event.key === 'F2') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'F4') {
        event.preventDefault()
        discountRef.current?.focus()
      }
      if (event.key === 'F8') {
        event.preventDefault()
        document.querySelector('.charge-button:not(:disabled)')?.click()
      }
      if (event.key === 'Escape' && cart.length) {
        event.preventDefault()
        clearCart()
      }
      if (event.key === 'Delete' && selectedId && !event.target.matches('input, textarea')) {
        event.preventDefault()
        removeItem(selectedId)
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [cart.length, clearCart, removeItem, selectedId])

  function submitSearch(event) {
    event.preventDefault()
    const parsed = parseScannerQuery(query, scanQuantity)
    const exact = products.find((product) => product.barcode && product.barcode === parsed.code)
    const candidate = exact || (visibleProducts.length === 1 ? visibleProducts[0] : null)
    if (candidate) {
      addProduct(candidate, parsed.quantity)
      setQuery('')
      setScanQuantity('1')
      searchRef.current?.focus()
    } else {
      firstProductRef.current?.focus()
    }
  }

  function selectMethod(nextMethod) {
    setMethod(nextMethod)
    setSplitPayment(false)
    setCheckoutError('')
  }

  async function charge() {
    const payments = splitPayment
      ? paymentMethods
          .map(([paymentMethod]) => ({
            method: paymentMethod,
            amount: normalizeMoney(amounts[paymentMethod]),
          }))
          .filter((payment) => payment.amount > 0)
      : [{ method, amount: amountDue }]
    const paid = normalizeMoney(payments.reduce((sum, payment) => sum + payment.amount, 0))
    if (paid !== amountDue) {
      setCheckoutError(`Faltan ${money.format(Math.abs(amountDue - paid))} para completar el pago.`)
      return
    }
    if (cashApplied && normalizeMoney(cashReceived || cashApplied) < cashApplied) {
      setCheckoutError('El efectivo recibido no alcanza para cubrir su parte del pago.')
      return
    }
    const completed = await finishSale({
      subtotal: total,
      discount: safeDiscount,
      total: amountDue,
      payments,
      cashReceived: normalizeMoney(cashReceived || cashApplied),
      change,
    })
    if (completed) {
      setAmounts({ CASH: '', CARD: '', TRANSFER: '' })
      setCashReceived('')
      setDiscount('')
      setSplitPayment(false)
      setCheckoutError('')
    }
  }

  return (
    <section className="sales-layout">
      <div className="catalog-panel">
        <form className="pos-search-row" onSubmit={submitSearch}>
          <label className="scan-quantity">
            <span>Cant.</span>
            <input
              inputMode="decimal"
              aria-label="Cantidad para el próximo producto"
              value={scanQuantity}
              onChange={(event) => setScanQuantity(event.target.value)}
            />
          </label>
          <label className="search">
            <Search size={20} aria-hidden="true" />
            <input
              ref={searchRef}
              autoFocus
              aria-label="Buscar producto, categoría o código"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitSearch(event)
              }}
              placeholder="Escaneá o buscá un producto"
            />
            <kbd>F2</kbd>
          </label>
        </form>
        <div className="category-row">
          <button className="chip selected" onClick={() => setQuery('')}>
            Todos
          </button>
          {categories.map((category) => (
            <button className="chip" key={category} onClick={() => setQuery(category)}>
              {category}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {visibleProducts.map((product, index) => {
            const status = stockStatus(product)
            return (
              <button
                ref={index === 0 ? firstProductRef : null}
                className="product-card"
                key={product.id}
                onClick={() => addProduct(product, Number(scanQuantity) || unitStep(product.unit))}
                disabled={product.stock <= 0 || !canSell}
              >
                <div className="product-visual" style={{ background: product.color }}>
                  {product.emoji}
                </div>
                <div className="product-info">
                  <strong>{product.name}</strong>
                  <span>
                    {money.format(product.price)} / {product.unit}
                  </span>
                  <small className={['low', 'critical'].includes(status.level) ? 'stock-low' : ''}>
                    {unitLabel(product.stock, product.unit)} en stock
                  </small>
                </div>
                <span className="add-circle">
                  <Plus size={17} aria-hidden="true" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <aside className="cart-panel">
        <div className="cart-header">
          <div>
            <h2>Venta actual</h2>
            <span>{cart.length ? `${cart.length} productos` : 'Sin productos'}</span>
          </div>
          {cart.length > 0 && (
            <button className="clear" onClick={clearCart}>
              Limpiar
            </button>
          )}
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <div>
                <ShoppingBag size={32} aria-hidden="true" />
              </div>
              <strong>Tu venta está vacía</strong>
              <span>Escaneá o elegí productos para agregarlos.</span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                className={selectedId === item.id ? 'cart-item selected-line' : 'cart-item'}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="mini-emoji" style={{ background: item.color }}>
                  {item.emoji}
                </div>
                <div className="cart-name">
                  <strong>{item.name}</strong>
                  <span>
                    {money.format(item.price)} / {item.unit}
                  </span>
                </div>
                <div className="qty">
                  <button
                    aria-label={`Reducir cantidad de ${item.name}`}
                    onClick={() => changeQuantity(item.id, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    aria-label={`Cantidad de ${item.name}`}
                    inputMode="decimal"
                    value={item.qty}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setQuantity(item.id, event.target.value)}
                  />
                  <button
                    aria-label={`Aumentar cantidad de ${item.name}`}
                    onClick={() => changeQuantity(item.id, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <strong>{money.format(item.price * item.qty)}</strong>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div className="discount-row">
            <label htmlFor="sale-discount">Descuento</label>
            <div>
              <span>$</span>
              <input
                ref={discountRef}
                id="sale-discount"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0"
              />
              <kbd>F4</kbd>
            </div>
          </div>
          <div className="total">
            <span>Total</span>
            <strong>{money.format(amountDue)}</strong>
          </div>
          <div className="payment-types">
            {paymentMethods.map(([value, label]) => (
              <button
                key={value}
                onClick={() => selectMethod(value)}
                className={!splitPayment && method === value ? 'payment chosen' : 'payment'}
                disabled={!canSell}
              >
                <WalletCards size={17} aria-hidden="true" />
                {label}
              </button>
            ))}
            <button
              className={splitPayment ? 'payment chosen' : 'payment'}
              onClick={() => setSplitPayment((current) => !current)}
              disabled={!canSell}
            >
              <Split size={17} aria-hidden="true" /> Mixto
            </button>
          </div>
          {splitPayment && (
            <div className="split-fields">
              {paymentMethods.map(([value, label]) => (
                <label key={value}>
                  {label}
                  <input
                    inputMode="decimal"
                    value={amounts[value]}
                    onChange={(event) =>
                      setAmounts((current) => ({ ...current, [value]: event.target.value }))
                    }
                    placeholder="$ 0"
                  />
                </label>
              ))}
            </div>
          )}
          {cashApplied > 0 && (
            <div className="cash-received">
              <label>
                Recibido en efectivo
                <input
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder={money.format(cashApplied)}
                />
              </label>
              <div className="tender-buttons">
                {[1000, 2000, 5000, 10000].map((bill) => (
                  <button
                    key={bill}
                    onClick={() => setCashReceived(String(closestTender(cashApplied, bill)))}
                  >
                    ${number.format(bill)}
                  </button>
                ))}
                <button onClick={() => setCashReceived(String(cashApplied))}>Justo</button>
              </div>
              <div className="change-display">
                <span>Vuelto</span>
                <strong>{money.format(change)}</strong>
              </div>
            </div>
          )}
          {checkoutError && (
            <div className="form-error" role="alert">
              {checkoutError}
            </div>
          )}
          <button className="charge-button" disabled={!cart.length || !canSell} onClick={charge}>
            {saleDone ? (
              <>
                <Check size={20} /> Venta registrada
              </>
            ) : (
              <>Cobrar {amountDue ? money.format(amountDue) : ''}</>
            )}
            <kbd>F8</kbd>
          </button>
          {saleDone && (
            <div className="print-controls">
              <select
                aria-label="Ancho del ticket"
                value={ticketWidth}
                onChange={(event) => setTicketWidth(event.target.value)}
              >
                <option value="80">80 mm</option>
                <option value="58">58 mm</option>
              </select>
              <button className="print-ticket" onClick={() => window.print()}>
                <Printer size={17} /> Imprimir ticket
              </button>
            </div>
          )}
        </div>
      </aside>
      {saleDone && (
        <article className={`printable-ticket ticket-${ticketWidth}`}>
          <h1>MiKiosco</h1>
          <p>{new Date(saleDone.date).toLocaleString('es-AR')}</p>
          {saleDone.items.map((item) => (
            <div key={item.id}>
              <span>
                {number.format(item.quantity)} x {item.name}
              </span>
              <b>{money.format(item.total)}</b>
            </div>
          ))}
          {saleDone.discount > 0 && <p>Descuento: {money.format(saleDone.discount)}</p>}
          <h2>Total: {money.format(saleDone.total)}</h2>
          {saleDone.change > 0 && <p>Vuelto: {money.format(saleDone.change)}</p>}
          <small>Gracias por tu compra</small>
        </article>
      )}
    </section>
  )
}

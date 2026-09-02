import { useState } from 'react'
import { PackagePlus, Plus, Truck } from 'lucide-react'
import { money } from '../lib/format'

export function SuppliersView({
  suppliers,
  products,
  demoMode,
  canEdit,
  onCreate,
  onPurchase,
  onPay,
}) {
  const [showSupplier, setShowSupplier] = useState(false)
  const [supplier, setSupplier] = useState({ name: '', phone: '', email: '' })
  const [purchase, setPurchase] = useState({
    supplierId: '',
    productId: '',
    quantity: '',
    unitCost: '',
    paidAmount: '',
    reference: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState({ supplierId: '', amount: '', method: 'TRANSFER' })

  async function createSupplier(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onCreate(supplier)
      setSupplier({ name: '', phone: '', email: '' })
      setShowSupplier(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function receivePurchase(event) {
    event.preventDefault()
    const quantity = Number(String(purchase.quantity).replace(',', '.'))
    const unitCost = Number(String(purchase.unitCost).replace(',', '.'))
    if (!purchase.supplierId || !purchase.productId || quantity <= 0 || unitCost < 0) {
      setError('Elegí proveedor y producto, y revisá cantidad y costo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPurchase({
        supplierId: purchase.supplierId,
        reference: purchase.reference,
        paidAmount: Number(purchase.paidAmount || 0),
        items: [{ productId: purchase.productId, quantity, unitCost }],
      })
      setPurchase({
        supplierId: '',
        productId: '',
        quantity: '',
        unitCost: '',
        paidAmount: '',
        reference: '',
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function paySupplier(event) {
    event.preventDefault()
    const amount = Number(String(payment.amount).replace(',', '.'))
    if (!payment.supplierId || !Number.isFinite(amount) || amount <= 0) {
      setError('Elegí un proveedor e ingresá un importe válido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPay(payment.supplierId, amount, payment.method)
      setPayment({ supplierId: '', amount: '', method: 'TRANSFER' })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="management suppliers-page">
      <div className="manage-header owner-header">
        <div>
          <p>Cargá mercadería, actualizá costos y controlá la deuda con cada proveedor.</p>
          {demoMode && <small className="demo-label">Datos de ejemplo</small>}
        </div>
        {canEdit && (
          <button
            className="primary compact-primary"
            onClick={() => setShowSupplier((value) => !value)}
          >
            <Plus size={17} /> Nuevo proveedor
          </button>
        )}
      </div>
      {showSupplier && (
        <form className="owner-form supplier-form" onSubmit={createSupplier}>
          <label>
            Nombre
            <input
              required
              value={supplier.name}
              onChange={(event) => setSupplier({ ...supplier, name: event.target.value })}
            />
          </label>
          <label>
            Teléfono
            <input
              value={supplier.phone}
              onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={supplier.email}
              onChange={(event) => setSupplier({ ...supplier, email: event.target.value })}
            />
          </label>
          <button className="primary" disabled={busy}>
            Guardar proveedor
          </button>
        </form>
      )}
      {canEdit && (
        <section className="purchase-panel supplier-payment-panel">
          <div className="panel-title">
            <div>
              <h2>Registrar pago</h2>
              <p>Descontalo de la deuda del proveedor.</p>
            </div>
            <Truck size={21} />
          </div>
          <form onSubmit={paySupplier}>
            <label>
              Proveedor
              <select
                value={payment.supplierId}
                onChange={(event) => setPayment({ ...payment, supplierId: event.target.value })}
              >
                <option value="">Elegir</option>
                {suppliers
                  .filter((item) => Number(item.currentDebt) > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {money.format(Number(item.currentDebt))}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Importe
              <input
                inputMode="decimal"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              />
            </label>
            <label>
              Medio
              <select
                value={payment.method}
                onChange={(event) => setPayment({ ...payment, method: event.target.value })}
              >
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
              </select>
            </label>
            <button className="primary" disabled={busy || !payment.supplierId}>
              Registrar pago
            </button>
          </form>
        </section>
      )}
      {canEdit && (
        <section className="purchase-panel">
          <div className="panel-title">
            <div>
              <h2>Ingresar mercadería</h2>
              <p>El stock y el costo se actualizan al confirmar.</p>
            </div>
            <PackagePlus size={21} />
          </div>
          <form onSubmit={receivePurchase}>
            <label>
              Proveedor
              <select
                value={purchase.supplierId}
                onChange={(event) => setPurchase({ ...purchase, supplierId: event.target.value })}
              >
                <option value="">Elegir</option>
                {suppliers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Producto
              <select
                value={purchase.productId}
                onChange={(event) => {
                  const product = products.find((item) => String(item.id) === event.target.value)
                  setPurchase({
                    ...purchase,
                    productId: event.target.value,
                    unitCost: product?.cost || '',
                  })
                }}
              >
                <option value="">Elegir</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                inputMode="decimal"
                value={purchase.quantity}
                onChange={(event) => setPurchase({ ...purchase, quantity: event.target.value })}
              />
            </label>
            <label>
              Costo unitario
              <input
                inputMode="decimal"
                value={purchase.unitCost}
                onChange={(event) => setPurchase({ ...purchase, unitCost: event.target.value })}
              />
            </label>
            <label>
              Pagado ahora
              <input
                inputMode="decimal"
                value={purchase.paidAmount}
                onChange={(event) => setPurchase({ ...purchase, paidAmount: event.target.value })}
              />
            </label>
            <label>
              Remito
              <input
                value={purchase.reference}
                onChange={(event) => setPurchase({ ...purchase, reference: event.target.value })}
              />
            </label>
            <button className="primary" disabled={busy}>
              Confirmar ingreso
            </button>
          </form>
        </section>
      )}
      {error && (
        <div className="form-error owner-error" role="alert">
          {error}
        </div>
      )}
      <div className="supplier-list">
        {suppliers.map((item) => (
          <article key={item.id}>
            <span className="supplier-icon">
              <Truck size={20} />
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.phone || item.email || 'Sin datos de contacto'}</small>
            </div>
            <div>
              <small>Deuda actual</small>
              <strong>{money.format(Number(item.currentDebt || 0))}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

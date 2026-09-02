import { useState } from 'react'
import { CircleDollarSign, Plus, UsersRound } from 'lucide-react'
import { money } from '../lib/format'

export function CustomersView({ customers, demoMode, canEdit, onCreate, onPay }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', document: '', creditLimit: '' })
  const [payments, setPayments] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const totalDebt = customers.reduce((sum, customer) => sum + Number(customer.balance), 0)

  async function createCustomer(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Ingresá el nombre del cliente.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onCreate({ ...form, creditLimit: Number(form.creditLimit || 0) })
      setForm({ name: '', phone: '', document: '', creditLimit: '' })
      setShowForm(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function registerPayment(customer) {
    const amount = Number(String(payments[customer.id] || '').replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(customer.balance)) {
      setError('El cobro debe ser mayor a cero y no superar el saldo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPay(customer, amount)
      setPayments((current) => ({ ...current, [customer.id]: '' }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="management customers-page">
      <div className="manage-header owner-header">
        <div>
          <p>Controlá saldos y cobrá cuentas corrientes sin perder el historial.</p>
          {demoMode && <small className="demo-label">Datos de ejemplo</small>}
        </div>
        {canEdit && (
          <button
            className="primary compact-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            <Plus size={17} /> Nuevo cliente
          </button>
        )}
      </div>
      <div className="owner-summary">
        <div>
          <UsersRound size={20} />
          <span>Clientes registrados</span>
          <strong>{customers.length}</strong>
        </div>
        <div>
          <CircleDollarSign size={20} />
          <span>Saldo total pendiente</span>
          <strong>{money.format(totalDebt)}</strong>
        </div>
      </div>
      {showForm && (
        <form className="owner-form" onSubmit={createCustomer}>
          <label>
            Nombre
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <label>
            Documento
            <input
              value={form.document}
              onChange={(event) => setForm({ ...form, document: event.target.value })}
            />
          </label>
          <label>
            Límite de fiado
            <input
              inputMode="decimal"
              value={form.creditLimit}
              onChange={(event) => setForm({ ...form, creditLimit: event.target.value })}
            />
          </label>
          <button className="primary" disabled={busy}>
            Guardar cliente
          </button>
        </form>
      )}
      {error && (
        <div className="form-error owner-error" role="alert">
          {error}
        </div>
      )}
      <div className="customer-list">
        {customers.map((customer) => {
          const balance = Number(customer.balance)
          const limit = Number(customer.creditLimit)
          return (
            <article key={customer.id}>
              <div className="customer-identity">
                <span>{customer.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{customer.name}</strong>
                  <small>{customer.phone || 'Sin teléfono'}</small>
                </div>
              </div>
              <div>
                <small>Compras</small>
                <strong>{customer.purchaseCount || 0}</strong>
              </div>
              <div>
                <small>Límite</small>
                <strong>{limit ? money.format(limit) : 'Sin límite'}</strong>
              </div>
              <div className={balance > 0 ? 'customer-balance pending' : 'customer-balance'}>
                <small>Saldo</small>
                <strong>{money.format(balance)}</strong>
              </div>
              {canEdit && balance > 0 && (
                <div className="account-payment">
                  <input
                    aria-label={`Cobro a ${customer.name}`}
                    inputMode="decimal"
                    value={payments[customer.id] || ''}
                    onChange={(event) =>
                      setPayments((current) => ({
                        ...current,
                        [customer.id]: event.target.value,
                      }))
                    }
                    placeholder="$ Importe"
                  />
                  <button disabled={busy} onClick={() => registerPayment(customer)}>
                    Cobrar
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Banknote, CircleDollarSign, ReceiptText, Search, WalletCards } from 'lucide-react'
import { useVersionedStorage } from '../hooks/useVersionedStorage'
import { businessApi } from '../lib/api'
import { money } from '../lib/format'

function cashAmount(sale) {
  if (Array.isArray(sale.payments)) {
    return sale.payments
      .filter((payment) => payment.method === 'CASH')
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  }
  return sale.payment === 'Efectivo' || sale.payment === 'CASH' ? Number(sale.total) : 0
}

export function CashView({
  sales,
  cashSession,
  demoMode,
  canOperate,
  canVoid,
  onOpen,
  onClose,
  onExpense,
  onVoid,
  onReturn,
}) {
  const [demoSession, setDemoSession] = useVersionedStorage('mikiosco-demo-cash', null)
  const [demoExpenses, setDemoExpenses] = useVersionedStorage('mikiosco-demo-expenses', [])
  const [serverExpenses, setServerExpenses] = useState([])
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseConcept, setExpenseConcept] = useState('')
  const [query, setQuery] = useState('')
  const [expandedSale, setExpandedSale] = useState(null)
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnMethods, setReturnMethods] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const session = demoMode ? demoSession : cashSession
  const expenses = demoMode ? demoExpenses : serverExpenses
  const sessionSales = useMemo(
    () =>
      sales.filter(
        (sale) =>
          sale.status !== 'VOIDED' &&
          (!session?.openedAt ||
            new Date(sale.date || sale.createdAt) >= new Date(session.openedAt)),
      ),
    [sales, session],
  )
  const cashSales = sessionSales.reduce((sum, sale) => sum + cashAmount(sale), 0)
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const expected =
    Number(session?.openingAmount || 0) +
    cashSales -
    expenseTotal -
    Number(session?.cashReturns || 0) +
    Number(session?.accountCollections || 0) -
    Number(session?.supplierPayments || 0)
  const filteredSales = [...sales].reverse().filter((sale) => {
    const text = [
      sale.ticketNumber,
      sale.date,
      sale.createdAt,
      ...sale.items.map((item) => item.name),
    ]
      .join(' ')
      .toLowerCase()
    return text.includes(query.toLowerCase())
  })

  useEffect(() => {
    if (demoMode || !session?.id) return undefined
    let active = true
    businessApi
      .expenses(session.id)
      .then((result) => {
        if (active) setServerExpenses(result.items)
      })
      .catch(() => {
        if (active) setError('No pudimos cargar los gastos de este turno.')
      })
    return () => {
      active = false
    }
  }, [demoMode, session?.id])

  async function openCash(event) {
    event.preventDefault()
    const amount = Number(String(openingAmount).replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Ingresá un fondo inicial válido.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (demoMode) {
        setDemoSession({
          id: crypto.randomUUID(),
          openingAmount: amount,
          openedAt: new Date().toISOString(),
          openedBy: 'Usuario demo',
          status: 'OPEN',
        })
        setDemoExpenses([])
      } else {
        await onOpen(amount)
      }
      setOpeningAmount('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addExpense(event) {
    event.preventDefault()
    const amount = Number(String(expenseAmount).replace(',', '.'))
    if (!expenseConcept.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Completá el concepto y un importe mayor a cero.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const expense = demoMode
        ? {
            id: crypto.randomUUID(),
            concept: expenseConcept.trim(),
            amount,
            createdAt: new Date().toISOString(),
          }
        : await onExpense({ cashSessionId: session.id, concept: expenseConcept.trim(), amount })
      if (demoMode) setDemoExpenses((current) => [...current, expense])
      else setServerExpenses((current) => [...current, expense])
      setExpenseAmount('')
      setExpenseConcept('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function closeCash(event) {
    event.preventDefault()
    const counted = Number(String(closingAmount).replace(',', '.'))
    if (!Number.isFinite(counted) || counted < 0) {
      setError('Ingresá el efectivo que contaste en la caja.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (demoMode) setDemoSession(null)
      else await onClose(session.id, counted)
      setClosingAmount('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function returnItem(sale, item) {
    const quantity = Number(String(returnQuantities[item.id] || '').replace(',', '.'))
    const available = Number(item.quantity) - Number(item.returnedQuantity || 0)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > available) {
      setError(`Ingresá una cantidad entre 0 y ${available}.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onReturn(sale, item, quantity, returnMethods[item.id] || 'CASH')
      setReturnQuantities((current) => ({ ...current, [item.id]: '' }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="management cash-management">
      {!session ? (
        <div className="cash-empty">
          <div className="cash-icon">
            <WalletCards size={30} />
          </div>
          <h2>Abrí la caja para empezar</h2>
          <p>Declará el efectivo inicial. Desde ahí, MiKiosco calcula cada movimiento.</p>
          {canOperate ? (
            <form onSubmit={openCash}>
              <label>
                Fondo inicial
                <input
                  inputMode="decimal"
                  value={openingAmount}
                  onChange={(event) => setOpeningAmount(event.target.value)}
                  placeholder="$ 0"
                />
              </label>
              <button className="primary" disabled={busy}>
                Abrir caja
              </button>
            </form>
          ) : (
            <p className="form-error">Tu perfil es solo de consulta.</p>
          )}
        </div>
      ) : (
        <>
          <div className="cash-card">
            <div className="cash-head">
              <div>
                <span className="eyebrow">TURNO ABIERTO</span>
                <h2>Caja del día</h2>
                <p>
                  Iniciada {new Date(session.openedAt).toLocaleString('es-AR')} por{' '}
                  {session.openedBy || 'el usuario actual'}
                </p>
              </div>
              <div className="cash-icon">
                <WalletCards size={32} />
              </div>
            </div>
            <div className="cash-numbers">
              <div>
                <span>Fondo inicial</span>
                <strong>{money.format(Number(session.openingAmount))}</strong>
              </div>
              <div>
                <span>Ventas en efectivo</span>
                <strong>{money.format(cashSales)}</strong>
              </div>
              <div>
                <span>Gastos y retiros</span>
                <strong>{money.format(expenseTotal)}</strong>
              </div>
              <div>
                <span>Dinero esperado</span>
                <strong>{money.format(expected)}</strong>
              </div>
            </div>
          </div>

          <div className="cash-workspace">
            <section className="cash-section">
              <div className="panel-title">
                <div>
                  <h2>Movimientos del turno</h2>
                  <p>Gastos, pagos y retiros quedan registrados.</p>
                </div>
                <CircleDollarSign size={21} />
              </div>
              {canOperate && (
                <form className="expense-form" onSubmit={addExpense}>
                  <input
                    aria-label="Concepto del gasto"
                    value={expenseConcept}
                    onChange={(event) => setExpenseConcept(event.target.value)}
                    placeholder="Ej. Pago al proveedor"
                  />
                  <input
                    aria-label="Importe del gasto"
                    inputMode="decimal"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    placeholder="$ 0"
                  />
                  <button disabled={busy}>Registrar</button>
                </form>
              )}
              <div className="movement-list">
                {expenses.length ? (
                  [...expenses].reverse().map((expense) => (
                    <div key={expense.id}>
                      <span className="movement-icon expense">
                        <Banknote size={17} />
                      </span>
                      <div>
                        <strong>{expense.concept}</strong>
                        <small>{new Date(expense.createdAt).toLocaleString('es-AR')}</small>
                      </div>
                      <b>-{money.format(Number(expense.amount))}</b>
                    </div>
                  ))
                ) : (
                  <p className="empty-row">Todavía no registraste gastos en este turno.</p>
                )}
              </div>
            </section>

            <section className="cash-section close-section">
              <div className="panel-title">
                <div>
                  <h2>Arqueo y cierre</h2>
                  <p>Contá el efectivo. La diferencia queda guardada.</p>
                </div>
              </div>
              <form onSubmit={closeCash}>
                <label>
                  Efectivo contado
                  <input
                    inputMode="decimal"
                    value={closingAmount}
                    onChange={(event) => setClosingAmount(event.target.value)}
                    placeholder={money.format(expected)}
                  />
                </label>
                {closingAmount !== '' && (
                  <div className="cash-difference">
                    <span>Diferencia</span>
                    <strong>{money.format(Number(closingAmount) - expected)}</strong>
                  </div>
                )}
                <button className="close-cash" disabled={busy || !canOperate}>
                  Cerrar caja
                </button>
              </form>
            </section>
          </div>
        </>
      )}

      {error && (
        <div className="form-error cash-error" role="alert">
          {error}
        </div>
      )}

      <section className="sales-history">
        <div className="panel-title">
          <div>
            <h2>Historial de ventas</h2>
            <p>Buscá por ticket, fecha o producto.</p>
          </div>
          <ReceiptText size={21} />
        </div>
        <label className="history-search">
          <Search size={17} />
          <input
            aria-label="Buscar venta por ticket, fecha o producto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar venta"
          />
        </label>
        <div className="history-list">
          {filteredSales.length ? (
            filteredSales.slice(0, 50).map((sale) => (
              <div className="history-record" key={sale.id}>
                <article>
                  <div>
                    <strong>Ticket {sale.ticketNumber || String(sale.id).slice(0, 8)}</strong>
                    <small>{new Date(sale.date || sale.createdAt).toLocaleString('es-AR')}</small>
                  </div>
                  <span>{sale.items.length} productos</span>
                  <b>{money.format(Number(sale.total))}</b>
                  {sale.status === 'VOIDED' ? (
                    <em>Anulada</em>
                  ) : (
                    <div className="history-actions">
                      <button
                        className="detail-button"
                        onClick={() =>
                          setExpandedSale((current) => (current === sale.id ? null : sale.id))
                        }
                      >
                        Detalle
                      </button>
                      {canVoid && <button onClick={() => onVoid(sale)}>Anular</button>}
                    </div>
                  )}
                </article>
                {expandedSale === sale.id && sale.status !== 'VOIDED' && (
                  <div className="return-lines">
                    {sale.items.map((item) => {
                      const available = Number(item.quantity) - Number(item.returnedQuantity || 0)
                      return (
                        <div key={item.id || item.productId}>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{available} disponibles para devolver</small>
                          </span>
                          <input
                            aria-label={`Cantidad a devolver de ${item.name}`}
                            inputMode="decimal"
                            value={returnQuantities[item.id] || ''}
                            onChange={(event) =>
                              setReturnQuantities((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="Cantidad"
                            disabled={!available}
                          />
                          <select
                            aria-label={`Medio de devolución de ${item.name}`}
                            value={returnMethods[item.id] || 'CASH'}
                            onChange={(event) =>
                              setReturnMethods((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="ACCOUNT">Cuenta</option>
                          </select>
                          <button
                            disabled={!canOperate || !available || busy}
                            onClick={() => returnItem(sale, item)}
                          >
                            Devolver
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="empty-row">No encontramos ventas con esa búsqueda.</p>
          )}
        </div>
      </section>
    </section>
  )
}

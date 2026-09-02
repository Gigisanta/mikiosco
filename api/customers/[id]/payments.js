import { requireRole } from '../../_lib/auth.js'
import { dbTransaction } from '../../_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from '../../_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER'])
  if (!user) return
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
  const amount = Number(request.body?.amount)
  const method = request.body?.method || 'CASH'
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(response, 422, { error: 'Ingresá un importe mayor a cero.' })
  }
  if (!['CASH', 'CARD', 'TRANSFER'].includes(method)) {
    return json(response, 422, { error: 'Elegí un medio de cobro válido.' })
  }
  const payment = await dbTransaction(async (client) => {
    if (request.body?.cashSessionId) {
      const session = await client.query(
        "SELECT id FROM cash_sessions WHERE id=$1 AND branch_id=$2 AND status='OPEN'",
        [request.body.cashSessionId, user.branchId],
      )
      if (!session.rowCount) {
        throw Object.assign(new Error('La caja indicada no está abierta.'), { statusCode: 422 })
      }
    }
    const customer = await client.query(
      'SELECT id,balance FROM customers WHERE id=$1 AND branch_id=$2 FOR UPDATE',
      [request.query.id, user.branchId],
    )
    if (!customer.rowCount) {
      throw Object.assign(new Error('Cliente no encontrado.'), { statusCode: 404 })
    }
    if (amount > Number(customer.rows[0].balance)) {
      throw Object.assign(new Error('El cobro supera el saldo pendiente.'), { statusCode: 422 })
    }
    const result = await client.query(
      `INSERT INTO customer_account_payments (customer_id,user_id,cash_session_id,method,amount,note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,amount,method,created_at AS "createdAt"`,
      [
        customer.rows[0].id,
        user.id,
        request.body.cashSessionId || null,
        method,
        amount,
        request.body.note || null,
      ],
    )
    await client.query('UPDATE customers SET balance=balance-$1 WHERE id=$2', [
      amount,
      customer.rows[0].id,
    ])
    return result.rows[0]
  })
  return json(response, 201, { payment })
}

export default withErrorHandling(handler)

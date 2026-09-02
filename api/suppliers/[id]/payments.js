import { requireRole } from '../../_lib/auth.js'
import { dbTransaction } from '../../_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from '../../_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN'])
  if (!user) return
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])

  const amount = Number(request.body?.amount)
  const method = request.body?.method || 'CASH'
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(response, 422, { error: 'Ingresá un importe mayor a cero.' })
  }
  if (!['CASH', 'CARD', 'TRANSFER'].includes(method)) {
    return json(response, 422, { error: 'Elegí un medio de pago válido.' })
  }

  const payment = await dbTransaction(async (client) => {
    if (method === 'CASH') {
      const session = await client.query(
        "SELECT id FROM cash_sessions WHERE id=$1 AND branch_id=$2 AND status='OPEN'",
        [request.body?.cashSessionId, user.branchId],
      )
      if (!session.rowCount) {
        throw Object.assign(new Error('Abrí una caja antes de pagar en efectivo.'), {
          statusCode: 422,
        })
      }
    }
    const supplier = await client.query(
      'SELECT id,current_debt FROM suppliers WHERE id=$1 AND branch_id=$2 FOR UPDATE',
      [request.query.id, user.branchId],
    )
    if (!supplier.rowCount) {
      throw Object.assign(new Error('Proveedor no encontrado.'), { statusCode: 404 })
    }
    if (amount > Number(supplier.rows[0].current_debt)) {
      throw Object.assign(new Error('El pago supera la deuda pendiente.'), { statusCode: 422 })
    }
    const result = await client.query(
      `INSERT INTO supplier_payments (supplier_id,user_id,cash_session_id,method,amount,note)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,amount,method,created_at AS "createdAt"`,
      [
        supplier.rows[0].id,
        user.id,
        method === 'CASH' ? request.body.cashSessionId : null,
        method,
        amount,
        request.body.note || null,
      ],
    )
    await client.query('UPDATE suppliers SET current_debt=current_debt-$1 WHERE id=$2', [
      amount,
      supplier.rows[0].id,
    ])
    return result.rows[0]
  })
  return json(response, 201, { payment })
}

export default withErrorHandling(handler)

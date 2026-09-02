import { requireRole } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT e.id,e.concept,e.amount,e.created_at AS "createdAt",u.name AS "createdBy"
       FROM cash_expenses e JOIN cash_sessions cs ON cs.id=e.cash_session_id
       JOIN users u ON u.id=e.user_id WHERE cs.branch_id=$1
       AND ($2::uuid IS NULL OR e.cash_session_id=$2) ORDER BY e.created_at DESC LIMIT 200`,
      [user.branchId, request.query.cashSessionId || null],
    )
    return json(response, 200, { items: result.rows })
  }
  if (request.method !== 'POST') return methodNotAllowed(response, ['GET', 'POST'])
  if (!['ADMIN', 'CASHIER'].includes(user.role)) {
    return json(response, 403, { error: 'No tenés permiso para registrar gastos.' })
  }
  const amount = Number(request.body?.amount)
  const concept = String(request.body?.concept || '').trim()
  if (!concept || !Number.isFinite(amount) || amount <= 0) {
    return json(response, 422, { error: 'Ingresá un concepto y un importe válido.' })
  }
  const result = await dbQuery(
    `INSERT INTO cash_expenses (cash_session_id,user_id,concept,amount)
     SELECT cs.id,$1,$2,$3 FROM cash_sessions cs
     WHERE cs.id=$4 AND cs.branch_id=$5 AND cs.status='OPEN'
     RETURNING id,concept,amount,created_at AS "createdAt"`,
    [user.id, concept, amount, request.body.cashSessionId, user.branchId],
  )
  if (!result.rowCount) return json(response, 422, { error: 'La caja indicada no está abierta.' })
  return json(response, 201, { item: result.rows[0] })
}

export default withErrorHandling(handler)

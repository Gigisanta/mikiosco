import { requireRole } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return

  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT cs.id,cs.opening_amount AS "openingAmount",cs.opened_at AS "openedAt",cs.status,
        u.name AS "openedBy",COALESCE(SUM(p.amount) FILTER (WHERE p.method='CASH'),0) AS "cashSales"
       FROM cash_sessions cs JOIN users u ON u.id=cs.opened_by
       LEFT JOIN sales s ON s.cash_session_id=cs.id AND s.status='COMPLETED'
       LEFT JOIN payments p ON p.sale_id=s.id
       WHERE cs.branch_id=$1 AND cs.status='OPEN'
       GROUP BY cs.id,u.name ORDER BY cs.opened_at DESC LIMIT 1`,
      [user.branchId],
    )
    return json(response, 200, { session: result.rows[0] || null })
  }

  if (!['ADMIN', 'CASHIER'].includes(user.role)) {
    return json(response, 403, { error: 'No tenés permiso para operar la caja.' })
  }
  if (request.method === 'POST') {
    const openingAmount = Number(request.body?.openingAmount)
    if (!Number.isFinite(openingAmount) || openingAmount < 0) {
      return json(response, 422, { error: 'Ingresá un fondo inicial válido.' })
    }
    const session = await dbTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.branchId])
      const open = await client.query(
        `SELECT id FROM cash_sessions WHERE branch_id=$1 AND status='OPEN' LIMIT 1`,
        [user.branchId],
      )
      if (open.rowCount)
        throw Object.assign(new Error('Ya hay una caja abierta.'), { statusCode: 409 })
      const result = await client.query(
        `INSERT INTO cash_sessions (branch_id,opened_by,opening_amount)
         VALUES ($1,$2,$3) RETURNING id,opening_amount AS "openingAmount",opened_at AS "openedAt",status`,
        [user.branchId, user.id, openingAmount],
      )
      return result.rows[0]
    })
    return json(response, 201, { session })
  }
  return methodNotAllowed(response, ['GET', 'POST'])
}

export default withErrorHandling(handler)

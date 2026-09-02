import { requireRole } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return

  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT cs.id,cs.opening_amount AS "openingAmount",cs.opened_at AS "openedAt",cs.status,
        u.name AS "openedBy",
        COALESCE((SELECT SUM(p.amount) FROM payments p JOIN sales s ON s.id=p.sale_id
          WHERE s.cash_session_id=cs.id AND s.status='COMPLETED' AND p.method='CASH'),0) AS "cashSales",
        COALESCE((SELECT SUM(e.amount) FROM cash_expenses e
          WHERE e.cash_session_id=cs.id),0) AS expenses,
        COALESCE((SELECT SUM(sr.total) FROM sale_returns sr JOIN sales s ON s.id=sr.sale_id
          WHERE s.cash_session_id=cs.id AND sr.refund_method='CASH'),0) AS "cashReturns"
       FROM cash_sessions cs JOIN users u ON u.id=cs.opened_by
       WHERE cs.branch_id=$1 AND cs.status='OPEN'
       ORDER BY cs.opened_at DESC LIMIT 1`,
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
  if (request.method === 'PATCH') {
    const closingAmount = Number(request.body?.closingAmount)
    if (!Number.isFinite(closingAmount) || closingAmount < 0) {
      return json(response, 422, { error: 'Ingresá el efectivo contado en caja.' })
    }
    const session = await dbTransaction(async (client) => {
      const found = await client.query(
        `SELECT cs.id,cs.opening_amount,
          COALESCE((SELECT SUM(p.amount) FROM payments p JOIN sales s ON s.id=p.sale_id
            WHERE s.cash_session_id=cs.id AND s.status='COMPLETED' AND p.method='CASH'),0) AS cash_sales,
          COALESCE((SELECT SUM(e.amount) FROM cash_expenses e WHERE e.cash_session_id=cs.id),0) AS expenses,
          COALESCE((SELECT SUM(sr.total) FROM sale_returns sr JOIN sales s ON s.id=sr.sale_id
            WHERE s.cash_session_id=cs.id AND sr.refund_method='CASH'),0) AS cash_returns
         FROM cash_sessions cs WHERE cs.id=$1 AND cs.branch_id=$2 AND cs.status='OPEN' FOR UPDATE`,
        [request.body?.id, user.branchId],
      )
      if (!found.rowCount) {
        throw Object.assign(new Error('La caja indicada no está abierta.'), { statusCode: 404 })
      }
      const expected =
        Number(found.rows[0].opening_amount) +
        Number(found.rows[0].cash_sales) -
        Number(found.rows[0].expenses) -
        Number(found.rows[0].cash_returns)
      const difference = closingAmount - expected
      const result = await client.query(
        `UPDATE cash_sessions SET status='CLOSED',closed_by=$1,closed_at=now(),
          expected_amount=$2,closing_amount=$3,difference=$4 WHERE id=$5
         RETURNING id,status,opened_at AS "openedAt",closed_at AS "closedAt",
          opening_amount AS "openingAmount",expected_amount AS "expectedAmount",
          closing_amount AS "closingAmount",difference`,
        [user.id, expected, closingAmount, difference, found.rows[0].id],
      )
      return result.rows[0]
    })
    return json(response, 200, { session })
  }
  return methodNotAllowed(response, ['GET', 'POST', 'PATCH'])
}

export default withErrorHandling(handler)

import { requireRole } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return

  if (request.method === 'GET') {
    const search = `%${String(request.query.q || '').trim()}%`
    const result = await dbQuery(
      `SELECT c.id,c.name,c.phone,c.document,c.credit_limit AS "creditLimit",c.balance,
        c.created_at AS "createdAt",COALESCE(COUNT(s.id),0)::int AS "purchaseCount"
       FROM customers c LEFT JOIN sales s ON s.customer_id=c.id AND s.status='COMPLETED'
       WHERE c.branch_id=$1 AND (c.name ILIKE $2 OR COALESCE(c.phone,'') ILIKE $2
         OR COALESCE(c.document,'') ILIKE $2)
       GROUP BY c.id ORDER BY c.name LIMIT 200`,
      [user.branchId, search],
    )
    return json(response, 200, { items: result.rows })
  }

  if (!['ADMIN', 'CASHIER'].includes(user.role)) {
    return json(response, 403, { error: 'No tenés permiso para modificar clientes.' })
  }
  if (request.method === 'POST') {
    const name = String(request.body?.name || '').trim()
    const creditLimit = Number(request.body?.creditLimit || 0)
    if (!name || !Number.isFinite(creditLimit) || creditLimit < 0) {
      return json(response, 422, { error: 'Revisá el nombre y el límite de fiado.' })
    }
    const result = await dbQuery(
      `INSERT INTO customers (branch_id,name,phone,document,credit_limit)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,name,phone,document,credit_limit AS "creditLimit",balance`,
      [user.branchId, name, request.body.phone || null, request.body.document || null, creditLimit],
    )
    return json(response, 201, { item: result.rows[0] })
  }
  if (request.method === 'PATCH') {
    const id = request.body?.id
    const name = String(request.body?.name || '').trim()
    const creditLimit = Number(request.body?.creditLimit || 0)
    if (!id || !name || !Number.isFinite(creditLimit) || creditLimit < 0) {
      return json(response, 422, { error: 'Revisá los datos del cliente.' })
    }
    const result = await dbQuery(
      `UPDATE customers SET name=$1,phone=$2,document=$3,credit_limit=$4
       WHERE id=$5 AND branch_id=$6
       RETURNING id,name,phone,document,credit_limit AS "creditLimit",balance`,
      [
        name,
        request.body.phone || null,
        request.body.document || null,
        creditLimit,
        id,
        user.branchId,
      ],
    )
    if (!result.rowCount) return json(response, 404, { error: 'Cliente no encontrado.' })
    return json(response, 200, { item: result.rows[0] })
  }
  return methodNotAllowed(response, ['GET', 'POST', 'PATCH'])
}

export default withErrorHandling(handler)

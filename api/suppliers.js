import { requireRole } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT id,name,phone,email,current_debt AS "currentDebt",created_at AS "createdAt"
       FROM suppliers WHERE branch_id=$1 ORDER BY name`,
      [user.branchId],
    )
    return json(response, 200, { items: result.rows })
  }
  if (user.role !== 'ADMIN') {
    return json(response, 403, { error: 'Solo un administrador puede modificar proveedores.' })
  }
  const name = String(request.body?.name || '').trim()
  if (!name) return json(response, 422, { error: 'Ingresá el nombre del proveedor.' })
  if (request.method === 'POST') {
    const result = await dbQuery(
      `INSERT INTO suppliers (branch_id,name,phone,email) VALUES ($1,$2,$3,$4)
       RETURNING id,name,phone,email,current_debt AS "currentDebt"`,
      [user.branchId, name, request.body.phone || null, request.body.email || null],
    )
    return json(response, 201, { item: result.rows[0] })
  }
  if (request.method === 'PATCH') {
    const result = await dbQuery(
      `UPDATE suppliers SET name=$1,phone=$2,email=$3 WHERE id=$4 AND branch_id=$5
       RETURNING id,name,phone,email,current_debt AS "currentDebt"`,
      [
        name,
        request.body.phone || null,
        request.body.email || null,
        request.body.id,
        user.branchId,
      ],
    )
    if (!result.rowCount) return json(response, 404, { error: 'Proveedor no encontrado.' })
    return json(response, 200, { item: result.rows[0] })
  }
  return methodNotAllowed(response, ['GET', 'POST', 'PATCH'])
}

export default withErrorHandling(handler)

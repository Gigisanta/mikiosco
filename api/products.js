import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'

export default async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const search = `%${String(request.query.q || '').trim()}%`
    const result = await dbQuery('SELECT id, name, barcode, sale_price AS "salePrice", cost_price AS "costPrice", stock, min_stock AS "minStock", category_id AS "categoryId" FROM products WHERE branch_id = $1 AND active = true AND (name ILIKE $2 OR COALESCE(barcode, \'\') ILIKE $2) ORDER BY name LIMIT 100', [user.branchId, search])
    return json(response, 200, { items: result.rows })
  }
  if (request.method === 'POST') {
    const { name, barcode, salePrice, costPrice = 0, stock = 0, minStock = 0, categoryId = null } = request.body || {}
    if (!name || Number(salePrice) < 0) return json(response, 422, { error: 'Nombre y precio de venta válidos son requeridos.' })
    const result = await dbQuery('INSERT INTO products (branch_id, name, barcode, sale_price, cost_price, stock, min_stock, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [user.branchId, name, barcode || null, salePrice, costPrice, stock, minStock, categoryId])
    return json(response, 201, { item: result.rows[0] })
  }
  return methodNotAllowed(response, ['GET', 'POST'])
}

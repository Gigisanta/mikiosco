import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const search = `%${String(request.query.q || '').trim()}%`
    const result = await dbQuery(
      `SELECT p.id, p.name, p.barcode, p.unit, p.sale_price AS "salePrice",
        p.cost_price AS "costPrice", p.stock, p.min_stock AS "minStock",
        p.max_stock AS "maxStock", p.category_id AS "categoryId",
        COALESCE(c.name, 'Sin categoría') AS "categoryName",
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN si.quantity ELSE 0 END), 0) AS sold
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON s.id = si.sale_id
      WHERE p.branch_id = $1 AND p.active = true
        AND (p.name ILIKE $2 OR COALESCE(p.barcode, '') ILIKE $2)
      GROUP BY p.id, c.name
      ORDER BY p.name LIMIT 100`,
      [user.branchId, search],
    )
    return json(response, 200, { items: result.rows })
  }
  if (request.method === 'POST') {
    if (user.role !== 'ADMIN') {
      return json(response, 403, { error: 'Solo un administrador puede crear productos.' })
    }
    const {
      name,
      barcode,
      unit = 'unidad',
      salePrice,
      costPrice = 0,
      stock = 0,
      minStock = 0,
      maxStock = 0,
      categoryId = null,
    } = request.body || {}
    if (
      !name ||
      Number(salePrice) < 0 ||
      Number(minStock) < 0 ||
      Number(maxStock) < Number(minStock)
    )
      return json(response, 422, { error: 'Revisá nombre, precios y límites de stock.' })
    const result = await dbQuery(
      'INSERT INTO products (branch_id, name, barcode, unit, sale_price, cost_price, stock, min_stock, max_stock, category_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [
        user.branchId,
        name,
        barcode || null,
        unit,
        salePrice,
        costPrice,
        stock,
        minStock,
        maxStock,
        categoryId,
      ],
    )
    return json(response, 201, { item: result.rows[0] })
  }
  return methodNotAllowed(response, ['GET', 'POST'])
}

export default withErrorHandling(handler)

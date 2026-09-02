import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { withErrorHandling } from './_lib/http.js'

const units = new Set(['unidad', 'kg', 'g', 'litro', 'ml', 'pack', 'caja', 'metro'])

async function resolveCategory(client, branchId, categoryId, categoryName) {
  if (categoryId) return categoryId
  const name = String(categoryName || '').trim()
  if (!name) return null
  const result = await client.query(
    `INSERT INTO categories (branch_id,name) VALUES ($1,$2)
     ON CONFLICT (branch_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [branchId, name],
  )
  return result.rows[0].id
}

function validProduct(body) {
  const minStock = Number(body.minStock || 0)
  const maxStock = Number(body.maxStock || 0)
  return (
    String(body.name || '').trim() &&
    units.has(body.unit || 'unidad') &&
    Number.isFinite(Number(body.salePrice)) &&
    Number(body.salePrice) >= 0 &&
    Number.isFinite(Number(body.costPrice || 0)) &&
    Number(body.costPrice || 0) >= 0 &&
    Number.isFinite(minStock) &&
    minStock >= 0 &&
    Number.isFinite(maxStock) &&
    maxStock >= 0 &&
    (maxStock === 0 || maxStock >= minStock)
  )
}

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const search = `%${String(request.query.q || '').trim()}%`
    const result = await dbQuery(
      `SELECT p.id, p.name, p.barcode, p.unit, p.sale_price AS "salePrice",
        p.cost_price AS "costPrice", p.stock, p.min_stock AS "minStock",
        p.max_stock AS "maxStock", p.category_id AS "categoryId",
        p.supplier_id AS "supplierId",
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
    const body = request.body || {}
    if (!validProduct(body)) {
      return json(response, 422, { error: 'Revisá nombre, precios y límites de stock.' })
    }
    const item = await dbTransaction(async (client) => {
      const categoryId = await resolveCategory(
        client,
        user.branchId,
        body.categoryId,
        body.categoryName,
      )
      const result = await client.query(
        `INSERT INTO products (branch_id,name,barcode,unit,sale_price,cost_price,stock,
          min_stock,max_stock,category_id,supplier_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id,name,barcode,unit,sale_price AS "salePrice",cost_price AS "costPrice",
          stock,min_stock AS "minStock",max_stock AS "maxStock",category_id AS "categoryId"`,
        [
          user.branchId,
          body.name.trim(),
          body.barcode || null,
          body.unit || 'unidad',
          body.salePrice,
          body.costPrice || 0,
          body.stock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          categoryId,
          body.supplierId || null,
        ],
      )
      return { ...result.rows[0], categoryName: body.categoryName || 'Sin categoría' }
    })
    return json(response, 201, { item })
  }
  if (request.method === 'PATCH') {
    if (user.role !== 'ADMIN') {
      return json(response, 403, { error: 'Solo un administrador puede editar productos.' })
    }
    const body = request.body || {}
    if (!body.id || !validProduct(body)) {
      return json(response, 422, { error: 'Revisá los datos del producto.' })
    }
    const item = await dbTransaction(async (client) => {
      const categoryId = await resolveCategory(
        client,
        user.branchId,
        body.categoryId,
        body.categoryName,
      )
      const result = await client.query(
        `UPDATE products SET name=$1,barcode=$2,unit=$3,sale_price=$4,cost_price=$5,
          stock=$6,min_stock=$7,max_stock=$8,category_id=$9,supplier_id=$10
         WHERE id=$11 AND branch_id=$12 AND active=true
         RETURNING id,name,barcode,unit,sale_price AS "salePrice",cost_price AS "costPrice",
          stock,min_stock AS "minStock",max_stock AS "maxStock",category_id AS "categoryId"`,
        [
          body.name.trim(),
          body.barcode || null,
          body.unit || 'unidad',
          body.salePrice,
          body.costPrice || 0,
          body.stock || 0,
          body.minStock || 0,
          body.maxStock || 0,
          categoryId,
          body.supplierId || null,
          body.id,
          user.branchId,
        ],
      )
      if (!result.rowCount) {
        throw Object.assign(new Error('Producto no encontrado.'), { statusCode: 404 })
      }
      return { ...result.rows[0], categoryName: body.categoryName || 'Sin categoría' }
    })
    return json(response, 200, { item })
  }
  if (request.method === 'DELETE') {
    if (user.role !== 'ADMIN') {
      return json(response, 403, { error: 'Solo un administrador puede dar de baja productos.' })
    }
    const result = await dbQuery(
      'UPDATE products SET active=false WHERE id=$1 AND branch_id=$2 AND active=true RETURNING id',
      [request.query.id, user.branchId],
    )
    if (!result.rowCount) return json(response, 404, { error: 'Producto no encontrado.' })
    return json(response, 200, { ok: true })
  }
  return methodNotAllowed(response, ['GET', 'POST', 'PATCH', 'DELETE'])
}

export default withErrorHandling(handler)

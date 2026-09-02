import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'

const units = new Set(['unidad', 'kg', 'g', 'litro', 'ml', 'pack', 'caja', 'metro'])
const validNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0

export default async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return

  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT id, name, barcode, unit, stock, min_stock AS "minStock", max_stock AS "maxStock",
        cost_price AS "costPrice", sale_price AS "salePrice",
        CASE WHEN stock <= 0 THEN 'CRITICAL' WHEN stock <= min_stock THEN 'LOW'
          WHEN max_stock > 0 AND stock >= max_stock THEN 'HIGH' ELSE 'OK' END AS status
       FROM products WHERE branch_id = $1 AND active = true ORDER BY status, name`,
      [user.branchId],
    )
    return json(response, 200, { items: result.rows })
  }

  if (request.method !== 'PATCH') return methodNotAllowed(response, ['GET', 'PATCH'])
  if (!['ADMIN', 'CASHIER'].includes(user.role))
    return json(response, 403, { error: 'No tenés permiso para actualizar stock.' })

  const items = request.body?.items
  if (!Array.isArray(items) || !items.length || items.length > 5000)
    return json(response, 422, { error: 'Enviá entre 1 y 5000 productos.' })

  try {
    const summary = await dbTransaction(async (client) => {
      let updated = 0
      let created = 0
      for (const item of items) {
        const name = String(item.name || '').trim()
        const unit = units.has(item.unit) ? item.unit : 'unidad'
        const minStock = Number(item.minStock ?? 0)
        const maxStock = Number(item.maxStock ?? 0)
        if (
          !name ||
          ![item.stock, minStock, maxStock, item.costPrice, item.salePrice].every(validNumber) ||
          (maxStock > 0 && maxStock < minStock)
        )
          throw new Error(`Datos inválidos para ${name || 'un producto'}.`)

        const found = await client.query(
          `SELECT id, stock FROM products WHERE branch_id = $1 AND
            (($2::text <> '' AND barcode = $2) OR lower(name) = lower($3)) LIMIT 1 FOR UPDATE`,
          [user.branchId, String(item.barcode || ''), name],
        )
        if (found.rowCount) {
          await client.query(
            `UPDATE products SET name=$1, unit=$2, stock=$3, min_stock=$4, max_stock=$5,
              cost_price=$6, sale_price=$7 WHERE id=$8`,
            [
              name,
              unit,
              item.stock,
              minStock,
              maxStock,
              item.costPrice,
              item.salePrice,
              found.rows[0].id,
            ],
          )
          const delta = Number(item.stock) - Number(found.rows[0].stock)
          if (delta)
            await client.query(
              `INSERT INTO stock_movements (branch_id, product_id, type, quantity, note, user_id)
             VALUES ($1,$2,'ADJUSTMENT',$3,$4,$5)`,
              [user.branchId, found.rows[0].id, delta, 'Actualización masiva por Excel', user.id],
            )
          updated += 1
        } else {
          const inserted = await client.query(
            `INSERT INTO products (branch_id, name, barcode, unit, stock, min_stock, max_stock, cost_price, sale_price)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [
              user.branchId,
              name,
              item.barcode || null,
              unit,
              item.stock,
              minStock,
              maxStock,
              item.costPrice,
              item.salePrice,
            ],
          )
          if (Number(item.stock))
            await client.query(
              `INSERT INTO stock_movements (branch_id, product_id, type, quantity, note, user_id)
             VALUES ($1,$2,'PURCHASE',$3,$4,$5)`,
              [user.branchId, inserted.rows[0].id, item.stock, 'Carga inicial por Excel', user.id],
            )
          created += 1
        }
      }
      return { updated, created }
    })
    return json(response, 200, summary)
  } catch (error) {
    return json(response, 422, { error: error.message || 'No se pudo actualizar el stock.' })
  }
}

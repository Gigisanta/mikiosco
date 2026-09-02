import { requireRole } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') {
    const result = await dbQuery(
      `SELECT po.id,po.reference,po.status,po.total,po.paid_amount AS "paidAmount",
        po.received_at AS "receivedAt",s.id AS "supplierId",s.name AS "supplierName"
       FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id
       WHERE po.branch_id=$1 ORDER BY po.received_at DESC LIMIT 200`,
      [user.branchId],
    )
    return json(response, 200, { items: result.rows })
  }
  if (request.method !== 'POST') return methodNotAllowed(response, ['GET', 'POST'])
  if (user.role !== 'ADMIN') {
    return json(response, 403, { error: 'Solo un administrador puede cargar compras.' })
  }
  const { supplierId, reference = null, items, paidAmount = 0 } = request.body || {}
  if (!supplierId || !Array.isArray(items) || !items.length) {
    return json(response, 422, { error: 'Elegí un proveedor y agregá productos.' })
  }
  const purchase = await dbTransaction(async (client) => {
    const supplier = await client.query('SELECT id FROM suppliers WHERE id=$1 AND branch_id=$2', [
      supplierId,
      user.branchId,
    ])
    if (!supplier.rowCount)
      throw Object.assign(new Error('Proveedor no encontrado.'), { statusCode: 404 })
    const total = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
      0,
    )
    const paid = Number(paidAmount)
    if (
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(paid) ||
      paid < 0 ||
      paid > total
    ) {
      throw Object.assign(new Error('Revisá cantidades, costos e importe pagado.'), {
        statusCode: 422,
      })
    }
    const inserted = await client.query(
      `INSERT INTO purchase_orders (branch_id,supplier_id,user_id,reference,total,paid_amount)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,total,paid_amount AS "paidAmount",received_at AS "receivedAt"`,
      [user.branchId, supplierId, user.id, reference, total, paid],
    )
    for (const item of items) {
      const quantity = Number(item.quantity)
      const unitCost = Number(item.unitCost)
      if (
        !item.productId ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitCost) ||
        unitCost < 0
      ) {
        throw Object.assign(new Error('Hay un producto con cantidad o costo inválido.'), {
          statusCode: 422,
        })
      }
      const product = await client.query(
        `UPDATE products SET stock=stock+$1,cost_price=$2
         WHERE id=$3 AND branch_id=$4 AND active=true RETURNING id`,
        [quantity, unitCost, item.productId, user.branchId],
      )
      if (!product.rowCount)
        throw Object.assign(new Error('Uno de los productos no existe.'), { statusCode: 404 })
      const lineTotal = quantity * unitCost
      await client.query(
        `INSERT INTO purchase_items (purchase_order_id,product_id,quantity,unit_cost,total)
         VALUES ($1,$2,$3,$4,$5)`,
        [inserted.rows[0].id, item.productId, quantity, unitCost, lineTotal],
      )
      await client.query(
        `INSERT INTO stock_movements (branch_id,product_id,type,quantity,reference_id,note,user_id)
         VALUES ($1,$2,'PURCHASE',$3,$4,$5,$6)`,
        [user.branchId, item.productId, quantity, inserted.rows[0].id, reference, user.id],
      )
    }
    await client.query('UPDATE suppliers SET current_debt=current_debt+$1 WHERE id=$2', [
      total - paid,
      supplierId,
    ])
    return inserted.rows[0]
  })
  return json(response, 201, { purchase })
}

export default withErrorHandling(handler)

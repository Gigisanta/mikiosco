import { requireRole } from '../_lib/auth.js'
import { dbQuery, dbTransaction } from '../_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from '../_lib/http.js'

async function getSale(user, id, response) {
  const result = await dbQuery(
    `SELECT s.id,s.ticket_number AS "ticketNumber",s.status,s.subtotal,s.discount,s.total,
      s.created_at AS "createdAt",c.name AS "customerName",u.name AS "soldBy",
      COALESCE(json_agg(DISTINCT jsonb_build_object('id',si.id,'productId',si.product_id,
        'name',si.product_name,'quantity',si.quantity,'unitPrice',si.unit_price,'total',si.total))
        FILTER (WHERE si.id IS NOT NULL),'[]') AS items,
      COALESCE(json_agg(DISTINCT jsonb_build_object('method',p.method,'amount',p.amount,
        'reference',p.reference)) FILTER (WHERE p.id IS NOT NULL),'[]') AS payments
     FROM sales s JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id
     LEFT JOIN sale_items si ON si.sale_id=s.id LEFT JOIN payments p ON p.sale_id=s.id
     WHERE s.id=$1 AND s.branch_id=$2 GROUP BY s.id,c.name,u.name`,
    [id, user.branchId],
  )
  if (!result.rowCount) return json(response, 404, { error: 'Venta no encontrada.' })
  return json(response, 200, { sale: result.rows[0] })
}

async function voidSale(user, id, response) {
  if (user.role !== 'ADMIN') {
    return json(response, 403, { error: 'Solo un administrador puede anular ventas.' })
  }
  const sale = await dbTransaction(async (client) => {
    const found = await client.query(
      `SELECT id,status,customer_id,total FROM sales WHERE id=$1 AND branch_id=$2 FOR UPDATE`,
      [id, user.branchId],
    )
    if (!found.rowCount) throw Object.assign(new Error('Venta no encontrada.'), { statusCode: 404 })
    if (found.rows[0].status === 'VOIDED') return { id, status: 'VOIDED', duplicated: true }
    const items = await client.query(
      `SELECT si.product_id,si.quantity,
        COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
          WHERE sri.sale_item_id=si.id),0) AS returned
       FROM sale_items si WHERE si.sale_id=$1`,
      [id],
    )
    for (const item of items.rows) {
      const remaining = Number(item.quantity) - Number(item.returned)
      if (!item.product_id || remaining <= 0) continue
      await client.query('UPDATE products SET stock=stock+$1 WHERE id=$2 AND branch_id=$3', [
        remaining,
        item.product_id,
        user.branchId,
      ])
      await client.query(
        `INSERT INTO stock_movements (branch_id,product_id,type,quantity,reference_id,note,user_id)
         VALUES ($1,$2,'RETURN',$3,$4,'Anulación de venta',$5)`,
        [user.branchId, item.product_id, remaining, id, user.id],
      )
    }
    if (found.rows[0].customer_id) {
      const account = await client.query(
        `SELECT COALESCE(SUM(amount),0) AS amount FROM payments
         WHERE sale_id=$1 AND method='ACCOUNT'`,
        [id],
      )
      const returned = await client.query(
        'SELECT COALESCE(SUM(total),0) AS total FROM sale_returns WHERE sale_id=$1',
        [id],
      )
      const remainingRatio = Math.max(
        0,
        1 - Number(returned.rows[0].total) / Number(found.rows[0].total || 1),
      )
      await client.query('UPDATE customers SET balance=GREATEST(0,balance-$1) WHERE id=$2', [
        Number(account.rows[0].amount) * remainingRatio,
        found.rows[0].customer_id,
      ])
    }
    await client.query("UPDATE sales SET status='VOIDED' WHERE id=$1", [id])
    return { id, status: 'VOIDED' }
  })
  return json(response, 200, { sale })
}

async function returnItems(user, id, request, response) {
  if (!['ADMIN', 'CASHIER'].includes(user.role)) {
    return json(response, 403, { error: 'No tenés permiso para registrar devoluciones.' })
  }
  const requested = request.body?.items
  const refundMethod = request.body?.refundMethod || 'CASH'
  if (!['CASH', 'CARD', 'TRANSFER', 'ACCOUNT'].includes(refundMethod)) {
    return json(response, 422, { error: 'Elegí un medio válido para la devolución.' })
  }
  if (!Array.isArray(requested) || !requested.length) {
    return json(response, 422, { error: 'Elegí al menos un producto para devolver.' })
  }
  const result = await dbTransaction(async (client) => {
    const sale = await client.query(
      `SELECT id,total,customer_id FROM sales
       WHERE id=$1 AND branch_id=$2 AND status='COMPLETED' FOR UPDATE`,
      [id, user.branchId],
    )
    if (!sale.rowCount) {
      throw Object.assign(new Error('La venta no está disponible para devolución.'), {
        statusCode: 404,
      })
    }
    const prepared = []
    for (const entry of requested) {
      const item = await client.query(
        `SELECT si.id,si.product_id,si.product_name,si.quantity,si.unit_price,
          COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
            WHERE sri.sale_item_id=si.id),0) AS returned
         FROM sale_items si WHERE si.id=$1 AND si.sale_id=$2 FOR UPDATE`,
        [entry.saleItemId, id],
      )
      const quantity = Number(entry.quantity)
      if (
        !item.rowCount ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > Number(item.rows[0].quantity) - Number(item.rows[0].returned)
      ) {
        throw Object.assign(new Error('La cantidad a devolver supera lo vendido.'), {
          statusCode: 422,
        })
      }
      prepared.push({ ...item.rows[0], returnQuantity: quantity })
    }
    const refundTotal = prepared.reduce(
      (sum, item) => sum + item.returnQuantity * Number(item.unit_price),
      0,
    )
    const created = await client.query(
      `INSERT INTO sale_returns (sale_id,user_id,total,refund_method,note)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,total,refund_method AS "refundMethod",
         created_at AS "createdAt"`,
      [id, user.id, refundTotal, refundMethod, request.body.note || null],
    )
    for (const item of prepared) {
      const lineTotal = item.returnQuantity * Number(item.unit_price)
      await client.query(
        `INSERT INTO sale_return_items (sale_return_id,sale_item_id,quantity,total)
         VALUES ($1,$2,$3,$4)`,
        [created.rows[0].id, item.id, item.returnQuantity, lineTotal],
      )
      if (item.product_id) {
        await client.query('UPDATE products SET stock=stock+$1 WHERE id=$2 AND branch_id=$3', [
          item.returnQuantity,
          item.product_id,
          user.branchId,
        ])
        await client.query(
          `INSERT INTO stock_movements (branch_id,product_id,type,quantity,reference_id,note,user_id)
           VALUES ($1,$2,'RETURN',$3,$4,'Devolución parcial',$5)`,
          [user.branchId, item.product_id, item.returnQuantity, id, user.id],
        )
      }
    }
    if (sale.rows[0].customer_id && refundMethod === 'ACCOUNT') {
      const account = await client.query(
        "SELECT COALESCE(SUM(amount),0) AS amount FROM payments WHERE sale_id=$1 AND method='ACCOUNT'",
        [id],
      )
      const accountRatio = Number(account.rows[0].amount) / Number(sale.rows[0].total || 1)
      const debtReduction = Math.min(refundTotal * accountRatio, Number(account.rows[0].amount))
      await client.query('UPDATE customers SET balance=GREATEST(0,balance-$1) WHERE id=$2', [
        debtReduction,
        sale.rows[0].customer_id,
      ])
    }
    return created.rows[0]
  })
  return json(response, 201, { return: result })
}

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  const id = request.query.id
  if (request.method === 'GET') return getSale(user, id, response)
  if (request.method === 'DELETE') return voidSale(user, id, response)
  if (request.method === 'PATCH') {
    if (request.body?.status === 'VOIDED') return voidSale(user, id, response)
    if (request.body?.items) return returnItems(user, id, request, response)
    return json(response, 422, { error: 'Indicá si querés anular o devolver productos.' })
  }
  return methodNotAllowed(response, ['GET', 'PATCH', 'DELETE'])
}

export default withErrorHandling(handler)

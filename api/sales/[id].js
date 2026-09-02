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
      `SELECT id,status,customer_id FROM sales WHERE id=$1 AND branch_id=$2 FOR UPDATE`,
      [id, user.branchId],
    )
    if (!found.rowCount) throw Object.assign(new Error('Venta no encontrada.'), { statusCode: 404 })
    if (found.rows[0].status === 'VOIDED') return { id, status: 'VOIDED', duplicated: true }
    const items = await client.query(
      'SELECT product_id,quantity FROM sale_items WHERE sale_id=$1',
      [id],
    )
    for (const item of items.rows) {
      if (!item.product_id) continue
      await client.query('UPDATE products SET stock=stock+$1 WHERE id=$2 AND branch_id=$3', [
        item.quantity,
        item.product_id,
        user.branchId,
      ])
      await client.query(
        `INSERT INTO stock_movements (branch_id,product_id,type,quantity,reference_id,note,user_id)
         VALUES ($1,$2,'RETURN',$3,$4,'Anulación de venta',$5)`,
        [user.branchId, item.product_id, item.quantity, id, user.id],
      )
    }
    if (found.rows[0].customer_id) {
      const account = await client.query(
        `SELECT COALESCE(SUM(amount),0) AS amount FROM payments
         WHERE sale_id=$1 AND method='ACCOUNT'`,
        [id],
      )
      await client.query('UPDATE customers SET balance=GREATEST(0,balance-$1) WHERE id=$2', [
        account.rows[0].amount,
        found.rows[0].customer_id,
      ])
    }
    await client.query("UPDATE sales SET status='VOIDED' WHERE id=$1", [id])
    return { id, status: 'VOIDED' }
  })
  return json(response, 200, { sale })
}

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  const id = request.query.id
  if (request.method === 'GET') return getSale(user, id, response)
  if (request.method === 'DELETE') return voidSale(user, id, response)
  if (request.method === 'PATCH') {
    if (request.body?.status !== 'VOIDED') {
      return json(response, 422, { error: 'La única transición permitida es anular la venta.' })
    }
    return voidSale(user, id, response)
  }
  return methodNotAllowed(response, ['GET', 'PATCH', 'DELETE'])
}

export default withErrorHandling(handler)

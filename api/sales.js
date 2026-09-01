import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbTransaction } from './_lib/database.js'

export default async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER'])
  if (!user) return
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
  const { items, payments, customerId = null, cashSessionId = null } = request.body || {}
  if (!Array.isArray(items) || !items.length || !Array.isArray(payments) || !payments.length) return json(response, 422, { error: 'La venta necesita productos y al menos un pago.' })
  try {
    const sale = await dbTransaction(async client => {
      const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0)
      const paid = payments.reduce((sum, item) => sum + Number(item.amount), 0)
      if (paid < total) throw new Error('El total recibido no cubre la venta.')
      const ticket = await client.query('SELECT COALESCE(MAX(ticket_number), 0) + 1 AS next FROM sales WHERE branch_id = $1 FOR UPDATE', [user.branchId])
      const inserted = await client.query('INSERT INTO sales (branch_id, cash_session_id, customer_id, user_id, ticket_number, subtotal, total) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id, ticket_number AS "ticketNumber", total', [user.branchId, cashSessionId, customerId, user.id, ticket.rows[0].next, total])
      for (const item of items) {
        const product = await client.query('SELECT id, name, stock, cost_price FROM products WHERE id = $1 AND branch_id = $2 FOR UPDATE', [item.productId, user.branchId])
        if (!product.rowCount || Number(product.rows[0].stock) < Number(item.quantity)) throw new Error(`Stock insuficiente para ${item.name || 'el producto'}.`)
        await client.query('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total) VALUES ($1,$2,$3,$4,$5,$6,$7)', [inserted.rows[0].id, product.rows[0].id, product.rows[0].name, item.quantity, item.unitPrice, product.rows[0].cost_price, Number(item.quantity) * Number(item.unitPrice)])
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, product.rows[0].id])
        await client.query("INSERT INTO stock_movements (branch_id, product_id, type, quantity, reference_id, user_id) VALUES ($1,$2,'SALE',$3,$4,$5)", [user.branchId, product.rows[0].id, -Math.abs(item.quantity), inserted.rows[0].id, user.id])
      }
      for (const payment of payments) await client.query('INSERT INTO payments (sale_id, method, amount, reference) VALUES ($1,$2,$3,$4)', [inserted.rows[0].id, payment.method, payment.amount, payment.reference || null])
      return inserted.rows[0]
    })
    return json(response, 201, { sale })
  } catch (error) { return json(response, 422, { error: error.message || 'No se pudo registrar la venta.' }) }
}

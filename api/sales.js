import { requireRole } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function listSales(user, request, response) {
  const limit = Math.min(200, Math.max(1, Number(request.query.limit || 50)))
  const result = await dbQuery(
    `SELECT s.id, s.ticket_number AS "ticketNumber", s.status, s.subtotal, s.discount,
      s.total, s.created_at AS "createdAt", s.customer_id AS "customerId",
      COALESCE(json_agg(json_build_object('id',si.id,'productId',si.product_id,'name',si.product_name,
        'quantity',si.quantity,'unitPrice',si.unit_price,'unitCost',si.unit_cost,'total',si.total,
        'returnedQuantity',COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
          WHERE sri.sale_item_id=si.id),0)))
        FILTER (WHERE si.id IS NOT NULL), '[]') AS items
     FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
     WHERE s.branch_id=$1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT $2`,
    [user.branchId, limit],
  )
  return json(response, 200, { items: result.rows })
}

async function createSale(user, request, response) {
  const {
    items,
    payments,
    customerId = null,
    cashSessionId,
    discount = 0,
    idempotencyKey,
  } = request.body || {}
  if (!Array.isArray(items) || !items.length || !Array.isArray(payments) || !payments.length) {
    return json(response, 422, { error: 'La venta necesita productos y al menos un pago.' })
  }
  if (!cashSessionId) return json(response, 422, { error: 'Abrí una caja antes de vender.' })
  if (!idempotencyKey) return json(response, 422, { error: 'Falta el identificador de la venta.' })

  try {
    const sale = await dbTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id, ticket_number AS "ticketNumber", total FROM sales
         WHERE branch_id=$1 AND idempotency_key=$2`,
        [user.branchId, idempotencyKey],
      )
      if (existing.rowCount) return { ...existing.rows[0], duplicated: true }

      const cashSession = await client.query(
        `SELECT id FROM cash_sessions WHERE id=$1 AND branch_id=$2 AND status='OPEN' FOR UPDATE`,
        [cashSessionId, user.branchId],
      )
      if (!cashSession.rowCount) throw new Error('La caja indicada no está abierta.')

      const preparedItems = []
      for (const item of [...items].sort((a, b) =>
        String(a.productId).localeCompare(String(b.productId)),
      )) {
        const quantity = Number(item.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Todas las cantidades deben ser mayores a cero.')
        }
        const product = await client.query(
          `SELECT id,name,stock,cost_price,sale_price FROM products
           WHERE id=$1 AND branch_id=$2 AND active=true FOR UPDATE`,
          [item.productId, user.branchId],
        )
        if (!product.rowCount || Number(product.rows[0].stock) < quantity) {
          throw new Error(`Stock insuficiente para ${item.name || 'el producto'}.`)
        }
        preparedItems.push({ ...product.rows[0], quantity })
      }
      const subtotal = preparedItems.reduce(
        (sum, item) => sum + item.quantity * Number(item.sale_price),
        0,
      )
      const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal))
      const total = subtotal - safeDiscount
      const methods = new Set(['CASH', 'CARD', 'TRANSFER', 'ACCOUNT'])
      const validPayments = payments.every(
        (payment) =>
          methods.has(payment.method) &&
          Number.isFinite(Number(payment.amount)) &&
          Number(payment.amount) > 0,
      )
      if (!validPayments) throw new Error('Hay un medio de pago o importe inválido.')
      const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      if (Math.abs(paid - total) > 0.01) throw new Error('Los pagos deben coincidir con el total.')

      const counter = await client.query(
        `INSERT INTO branch_ticket_counters (branch_id,next_value) VALUES ($1,2)
         ON CONFLICT (branch_id) DO UPDATE SET next_value=branch_ticket_counters.next_value+1
         RETURNING next_value-1 AS ticket_number`,
        [user.branchId],
      )
      const inserted = await client.query(
        `INSERT INTO sales (branch_id,cash_session_id,customer_id,user_id,idempotency_key,
          ticket_number,subtotal,discount,total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id,ticket_number AS "ticketNumber",total`,
        [
          user.branchId,
          cashSessionId,
          customerId,
          user.id,
          idempotencyKey,
          counter.rows[0].ticket_number,
          subtotal,
          safeDiscount,
          total,
        ],
      )

      for (const item of preparedItems) {
        const lineTotal = item.quantity * Number(item.sale_price)
        await client.query(
          `INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,unit_cost,total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            inserted.rows[0].id,
            item.id,
            item.name,
            item.quantity,
            item.sale_price,
            item.cost_price,
            lineTotal,
          ],
        )
        await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [
          item.quantity,
          item.id,
        ])
        await client.query(
          `INSERT INTO stock_movements (branch_id,product_id,type,quantity,reference_id,user_id)
           VALUES ($1,$2,'SALE',$3,$4,$5)`,
          [user.branchId, item.id, -Math.abs(item.quantity), inserted.rows[0].id, user.id],
        )
      }

      const accountAmount = payments
        .filter((payment) => payment.method === 'ACCOUNT')
        .reduce((sum, payment) => sum + Number(payment.amount), 0)
      if (accountAmount) {
        if (!customerId) throw new Error('Elegí un cliente para vender a cuenta.')
        const customer = await client.query(
          'SELECT balance,credit_limit FROM customers WHERE id=$1 AND branch_id=$2 FOR UPDATE',
          [customerId, user.branchId],
        )
        if (!customer.rowCount) throw new Error('El cliente no pertenece a esta sucursal.')
        const nextBalance = Number(customer.rows[0].balance) + accountAmount
        const limit = Number(customer.rows[0].credit_limit)
        if (limit > 0 && nextBalance > limit) throw new Error('La venta supera el límite de fiado.')
        await client.query('UPDATE customers SET balance=$1 WHERE id=$2', [nextBalance, customerId])
      }

      for (const payment of payments) {
        await client.query(
          'INSERT INTO payments (sale_id,method,amount,reference) VALUES ($1,$2,$3,$4)',
          [inserted.rows[0].id, payment.method, payment.amount, payment.reference || null],
        )
      }
      return inserted.rows[0]
    })
    return json(response, sale.duplicated ? 200 : 201, { sale })
  } catch (error) {
    return json(response, 422, { error: error.message || 'No se pudo registrar la venta.' })
  }
}

async function salesHandler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method === 'GET') return listSales(user, request, response)
  if (request.method === 'POST') {
    if (!['ADMIN', 'CASHIER'].includes(user.role)) {
      return json(response, 403, { error: 'No tenés permiso para registrar ventas.' })
    }
    return createSale(user, request, response)
  }
  return methodNotAllowed(response, ['GET', 'POST'])
}

export default withErrorHandling(salesHandler)

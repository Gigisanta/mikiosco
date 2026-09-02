import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery, dbTransaction } from './_lib/database.js'
import { withErrorHandling } from './_lib/http.js'

async function updatePrices(request, response, user) {
  if (user.role !== 'ADMIN') return json(response, 403, { error: 'Acceso denegado.' })
  if (request.method !== 'PATCH') return methodNotAllowed(response, ['PATCH'])
  const percentage = Number(request.body?.percentage)
  const rounding = Number(request.body?.rounding || 0)
  const scope = request.body?.scope || 'all'
  const selectedIds = Array.isArray(request.body?.productIds) ? request.body.productIds : []
  if (!Number.isFinite(percentage) || percentage <= -100 || percentage > 1000) {
    return json(response, 422, { error: 'Ingresá un porcentaje entre -99,99% y 1000%.' })
  }
  if (![0, 1, 10, 50, 100].includes(rounding)) {
    return json(response, 422, { error: 'El redondeo elegido no es válido.' })
  }
  const updated = await dbTransaction(async (client) => {
    const values = [user.branchId]
    let filter = ''
    if (scope === 'category') {
      values.push(request.body.categoryId)
      filter = ` AND category_id=$${values.length}`
    } else if (scope === 'supplier') {
      values.push(request.body.supplierId)
      filter = ` AND supplier_id=$${values.length}`
    } else if (scope === 'selected') {
      if (!selectedIds.length) {
        throw Object.assign(new Error('Seleccioná al menos un producto.'), { statusCode: 422 })
      }
      values.push(selectedIds)
      filter = ` AND id=ANY($${values.length}::uuid[])`
    } else if (scope !== 'all') {
      throw Object.assign(new Error('El alcance elegido no es válido.'), { statusCode: 422 })
    }
    values.push(1 + percentage / 100, rounding)
    const factorIndex = values.length - 1
    const roundingIndex = values.length
    const result = await client.query(
      `UPDATE products SET sale_price=CASE WHEN $${roundingIndex}::numeric > 0
        THEN CEIL((sale_price*$${factorIndex})/$${roundingIndex})*$${roundingIndex}
        ELSE ROUND(sale_price*$${factorIndex},2) END
       WHERE branch_id=$1 AND active=true${filter}
       RETURNING id,sale_price AS "salePrice"`,
      values,
    )
    return result.rows
  })
  return json(response, 200, { items: updated, count: updated.length })
}

async function createBackup(request, response, user) {
  if (user.role !== 'ADMIN') return json(response, 403, { error: 'Acceso denegado.' })
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
  const [
    branch,
    categories,
    products,
    customers,
    suppliers,
    sales,
    saleItems,
    payments,
    cash,
    expenses,
    purchases,
    purchaseItems,
    stockMovements,
  ] = await Promise.all([
    dbQuery('SELECT id,name,address FROM branches WHERE id=$1', [user.branchId]),
    dbQuery('SELECT * FROM categories WHERE branch_id=$1 ORDER BY name', [user.branchId]),
    dbQuery('SELECT * FROM products WHERE branch_id=$1 ORDER BY name', [user.branchId]),
    dbQuery('SELECT * FROM customers WHERE branch_id=$1 ORDER BY name', [user.branchId]),
    dbQuery('SELECT * FROM suppliers WHERE branch_id=$1 ORDER BY name', [user.branchId]),
    dbQuery('SELECT * FROM sales WHERE branch_id=$1 ORDER BY created_at', [user.branchId]),
    dbQuery(
      'SELECT si.* FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.branch_id=$1 ORDER BY s.created_at,si.id',
      [user.branchId],
    ),
    dbQuery(
      'SELECT p.* FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.branch_id=$1 ORDER BY p.created_at',
      [user.branchId],
    ),
    dbQuery('SELECT * FROM cash_sessions WHERE branch_id=$1 ORDER BY opened_at', [user.branchId]),
    dbQuery(
      'SELECT e.* FROM cash_expenses e JOIN cash_sessions cs ON cs.id=e.cash_session_id WHERE cs.branch_id=$1 ORDER BY e.created_at',
      [user.branchId],
    ),
    dbQuery('SELECT * FROM purchase_orders WHERE branch_id=$1 ORDER BY created_at', [
      user.branchId,
    ]),
    dbQuery(
      'SELECT pi.* FROM purchase_items pi JOIN purchase_orders po ON po.id=pi.purchase_order_id WHERE po.branch_id=$1 ORDER BY po.created_at,pi.id',
      [user.branchId],
    ),
    dbQuery('SELECT * FROM stock_movements WHERE branch_id=$1 ORDER BY created_at', [
      user.branchId,
    ]),
  ])

  return json(response, 200, {
    format: 'mikiosco-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    branch: branch.rows[0],
    data: {
      categories: categories.rows,
      products: products.rows,
      customers: customers.rows,
      suppliers: suppliers.rows,
      sales: sales.rows,
      saleItems: saleItems.rows,
      payments: payments.rows,
      cashSessions: cash.rows,
      expenses: expenses.rows,
      purchases: purchases.rows,
      purchaseItems: purchaseItems.rows,
      stockMovements: stockMovements.rows,
    },
  })
}

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'VIEWER'])
  if (!user) return
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname.endsWith('/prices')) return updatePrices(request, response, user)
  if (pathname.endsWith('/backup')) return createBackup(request, response, user)
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])

  const months = Math.min(24, Math.max(1, Number(request.query.months || 12)))
  const netItems = `WITH net_items AS (
    SELECT si.*,
      si.quantity - COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id=sri.sale_return_id
        WHERE sri.sale_item_id=si.id),0) AS net_quantity
    FROM sale_items si
  )`
  const [monthly, bestSellers, bestMargins, categories] = await Promise.all([
    dbQuery(
      `${netItems}
       SELECT date_trunc('month', s.created_at) AS month,
        SUM(ni.unit_price * ni.net_quantity)::numeric AS revenue,
        SUM((ni.unit_price - ni.unit_cost) * ni.net_quantity)::numeric AS profit,
        COUNT(DISTINCT s.id)::int AS tickets
       FROM sales s JOIN net_items ni ON ni.sale_id = s.id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND s.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
        AND ni.net_quantity > 0 GROUP BY 1 ORDER BY 1`,
      [user.branchId, months],
    ),
    dbQuery(
      `${netItems}
       SELECT ni.product_id AS id, ni.product_name AS name,
        SUM(ni.net_quantity)::numeric AS quantity,
        SUM(ni.unit_price * ni.net_quantity)::numeric AS revenue
       FROM net_items ni JOIN sales s ON s.id=ni.sale_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
       GROUP BY 1,2 ORDER BY quantity DESC LIMIT 10`,
      [user.branchId],
    ),
    dbQuery(
      `${netItems}
       SELECT ni.product_id AS id, ni.product_name AS name,
        SUM((ni.unit_price-ni.unit_cost)*ni.net_quantity)::numeric AS profit,
        CASE WHEN SUM(ni.unit_price*ni.net_quantity)>0
          THEN SUM((ni.unit_price-ni.unit_cost)*ni.net_quantity)/SUM(ni.unit_price*ni.net_quantity)
          ELSE 0 END AS margin
       FROM net_items ni JOIN sales s ON s.id=ni.sale_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
       GROUP BY 1,2 ORDER BY profit DESC LIMIT 10`,
      [user.branchId],
    ),
    dbQuery(
      `${netItems}
       SELECT COALESCE(c.name,'Sin categoría') AS category,
        SUM(ni.unit_price*ni.net_quantity)::numeric AS revenue
       FROM net_items ni JOIN sales s ON s.id=ni.sale_id
        LEFT JOIN products p ON p.id=ni.product_id LEFT JOIN categories c ON c.id=p.category_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
       GROUP BY 1 ORDER BY revenue DESC`,
      [user.branchId],
    ),
  ])

  return json(response, 200, {
    monthly: monthly.rows,
    bestSellers: bestSellers.rows,
    bestMargins: bestMargins.rows,
    categories: categories.rows,
  })
}

export default withErrorHandling(handler)

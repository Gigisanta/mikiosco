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

  const requestedMonths = Number(request.query.months || 60)
  const months = Number.isFinite(requestedMonths)
    ? Math.min(120, Math.max(12, Math.trunc(requestedMonths)))
    : 60
  const requestedMonth = String(request.query.month || '')
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7)

  const monthly = await dbQuery(
    `WITH month_axis AS (
      SELECT generate_series(
        date_trunc('month', now()) - ($2::int - 1) * interval '1 month',
        date_trunc('month', now()),
        interval '1 month'
      ) AS month
    ), returned AS (
      SELECT sri.sale_item_id, SUM(sri.quantity) AS quantity
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id=sri.sale_return_id
      JOIN sale_items rsi ON rsi.id=sri.sale_item_id
      JOIN sales rs ON rs.id=rsi.sale_id
      WHERE rs.branch_id=$1
      GROUP BY sri.sale_item_id
    ), net_items AS (
      SELECT si.*,
        GREATEST(si.quantity - COALESCE(r.quantity, 0), 0) AS net_quantity
      FROM sale_items si
      LEFT JOIN returned r ON r.sale_item_id=si.id
    ), sales_monthly AS (
      SELECT date_trunc('month', s.created_at) AS month,
        SUM(ni.unit_price * ni.net_quantity)::numeric AS revenue,
        SUM(ni.unit_cost * ni.net_quantity)::numeric AS "costOfGoods",
        SUM((ni.unit_price - ni.unit_cost) * ni.net_quantity)::numeric AS "grossProfit",
        COUNT(DISTINCT s.id)::int AS tickets,
        SUM(ni.net_quantity)::numeric AS "unitsSold"
      FROM sales s
      JOIN net_items ni ON ni.sale_id=s.id
      WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
        AND s.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
      GROUP BY 1
    ), purchases_monthly AS (
      SELECT date_trunc('month', po.received_at) AS month,
        SUM(po.total)::numeric AS purchases,
        SUM(po.paid_amount)::numeric AS "initialPayments"
      FROM purchase_orders po
      WHERE po.branch_id=$1 AND po.status='RECEIVED'
        AND po.received_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
      GROUP BY 1
    ), later_payments_monthly AS (
      SELECT date_trunc('month', sp.created_at) AS month,
        SUM(sp.amount)::numeric AS payments
      FROM supplier_payments sp
      JOIN suppliers su ON su.id=sp.supplier_id
      WHERE su.branch_id=$1
        AND sp.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
      GROUP BY 1
    ), expenses_monthly AS (
      SELECT date_trunc('month', ce.created_at) AS month,
        SUM(ce.amount)::numeric AS expenses
      FROM cash_expenses ce
      JOIN cash_sessions cs ON cs.id=ce.cash_session_id
      WHERE cs.branch_id=$1
        AND ce.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
      GROUP BY 1
    ), product_monthly AS (
      SELECT date_trunc('month', s.created_at) AS month,
        ni.product_name AS name,
        SUM(ni.net_quantity)::numeric AS quantity
      FROM sales s
      JOIN net_items ni ON ni.sale_id=s.id
      WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
        AND s.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
      GROUP BY 1,2
    ), ranked_products AS (
      SELECT month, name, quantity,
        ROW_NUMBER() OVER (PARTITION BY month ORDER BY quantity DESC, name) AS position
      FROM product_monthly
    )
    SELECT to_char(ma.month, 'YYYY-MM') AS month,
      COALESCE(sm.revenue, 0)::numeric AS revenue,
      COALESCE(sm."costOfGoods", 0)::numeric AS "costOfGoods",
      COALESCE(sm."grossProfit", 0)::numeric AS "grossProfit",
      CASE WHEN COALESCE(sm.revenue, 0) > 0
        THEN sm."grossProfit" / sm.revenue ELSE 0 END::numeric AS "grossMargin",
      COALESCE(sm.tickets, 0)::int AS tickets,
      COALESCE(sm."unitsSold", 0)::numeric AS "unitsSold",
      COALESCE(pm.purchases, 0)::numeric AS purchases,
      (COALESCE(pm."initialPayments", 0) + COALESCE(lpm.payments, 0))::numeric AS "supplierPayments",
      COALESCE(em.expenses, 0)::numeric AS "operatingExpenses",
      (COALESCE(sm."grossProfit", 0) - COALESCE(em.expenses, 0))::numeric AS "operatingResult",
      rp.name AS "topProductName",
      COALESCE(rp.quantity, 0)::numeric AS "topProductQuantity"
    FROM month_axis ma
    LEFT JOIN sales_monthly sm ON sm.month=ma.month
    LEFT JOIN purchases_monthly pm ON pm.month=ma.month
    LEFT JOIN later_payments_monthly lpm ON lpm.month=ma.month
    LEFT JOIN expenses_monthly em ON em.month=ma.month
    LEFT JOIN ranked_products rp ON rp.month=ma.month AND rp.position=1
    ORDER BY ma.month`,
    [user.branchId, months],
  )

  const analyticsCtes = `WITH period AS (
      SELECT to_date($2 || '-01', 'YYYY-MM-DD') AS start_at
    ), returned AS (
      SELECT sri.sale_item_id, SUM(sri.quantity) AS quantity
      FROM sale_return_items sri
      JOIN sale_returns sr ON sr.id=sri.sale_return_id
      JOIN sale_items rsi ON rsi.id=sri.sale_item_id
      JOIN sales rs ON rs.id=rsi.sale_id
      WHERE rs.branch_id=$1
      GROUP BY sri.sale_item_id
    ), net_items AS (
      SELECT si.*,
        GREATEST(si.quantity - COALESCE(r.quantity, 0), 0) AS net_quantity
      FROM sale_items si
      LEFT JOIN returned r ON r.sale_item_id=si.id
    )`

  const [bestSellers, bestMargins, categories, suppliers] = await Promise.all([
    dbQuery(
      `${analyticsCtes}
       SELECT ni.product_id AS id, ni.product_name AS name,
        COALESCE(p.unit, 'unidad') AS unit,
        SUM(ni.net_quantity)::numeric AS quantity,
        SUM(ni.unit_price * ni.net_quantity)::numeric AS revenue
       FROM net_items ni
       JOIN sales s ON s.id=ni.sale_id
       CROSS JOIN period pe
       LEFT JOIN products p ON p.id=ni.product_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
        AND s.created_at >= pe.start_at AND s.created_at < pe.start_at + interval '1 month'
       GROUP BY 1,2,3 ORDER BY quantity DESC, revenue DESC LIMIT 10`,
      [user.branchId, selectedMonth],
    ),
    dbQuery(
      `${analyticsCtes}
       SELECT ni.product_id AS id, ni.product_name AS name,
        SUM((ni.unit_price-ni.unit_cost)*ni.net_quantity)::numeric AS profit,
        CASE WHEN SUM(ni.unit_price*ni.net_quantity)>0
          THEN SUM((ni.unit_price-ni.unit_cost)*ni.net_quantity)/SUM(ni.unit_price*ni.net_quantity)
          ELSE 0 END::numeric AS margin
       FROM net_items ni
       JOIN sales s ON s.id=ni.sale_id
       CROSS JOIN period pe
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
        AND s.created_at >= pe.start_at AND s.created_at < pe.start_at + interval '1 month'
       GROUP BY 1,2 ORDER BY profit DESC, margin DESC LIMIT 10`,
      [user.branchId, selectedMonth],
    ),
    dbQuery(
      `${analyticsCtes}
       SELECT COALESCE(c.name,'Sin categoría') AS category,
        SUM(ni.unit_price*ni.net_quantity)::numeric AS revenue
       FROM net_items ni
       JOIN sales s ON s.id=ni.sale_id
       CROSS JOIN period pe
       LEFT JOIN products p ON p.id=ni.product_id
       LEFT JOIN categories c ON c.id=p.category_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND ni.net_quantity > 0
        AND s.created_at >= pe.start_at AND s.created_at < pe.start_at + interval '1 month'
       GROUP BY 1 ORDER BY revenue DESC`,
      [user.branchId, selectedMonth],
    ),
    dbQuery(
      `WITH period AS (
        SELECT to_date($2 || '-01', 'YYYY-MM-DD') AS start_at
      ), purchases AS (
        SELECT po.supplier_id, SUM(po.total)::numeric AS purchases,
          SUM(po.paid_amount)::numeric AS "initialPayments"
        FROM purchase_orders po CROSS JOIN period pe
        WHERE po.branch_id=$1 AND po.status='RECEIVED'
          AND po.received_at >= pe.start_at AND po.received_at < pe.start_at + interval '1 month'
        GROUP BY po.supplier_id
      ), later_payments AS (
        SELECT sp.supplier_id, SUM(sp.amount)::numeric AS payments
        FROM supplier_payments sp CROSS JOIN period pe
        JOIN suppliers su ON su.id=sp.supplier_id
        WHERE su.branch_id=$1
          AND sp.created_at >= pe.start_at AND sp.created_at < pe.start_at + interval '1 month'
        GROUP BY sp.supplier_id
      )
      SELECT su.id, su.name,
        COALESCE(pu.purchases, 0)::numeric AS purchases,
        (COALESCE(pu."initialPayments", 0) + COALESCE(lp.payments, 0))::numeric AS paid
      FROM suppliers su
      LEFT JOIN purchases pu ON pu.supplier_id=su.id
      LEFT JOIN later_payments lp ON lp.supplier_id=su.id
      WHERE su.branch_id=$1 AND (COALESCE(pu.purchases, 0) > 0 OR COALESCE(lp.payments, 0) > 0)
      ORDER BY purchases DESC, paid DESC, su.name`,
      [user.branchId, selectedMonth],
    ),
  ])

  const selectedIndex = monthly.rows.findIndex((row) => row.month === selectedMonth)
  const selectedSummary =
    selectedIndex >= 0 ? monthly.rows[selectedIndex] : { month: selectedMonth }
  const previousSummary = selectedIndex > 0 ? monthly.rows[selectedIndex - 1] : null

  return json(response, 200, {
    monthly: monthly.rows,
    selected: {
      month: selectedMonth,
      summary: selectedSummary,
      previous: previousSummary,
      bestSellers: bestSellers.rows,
      bestMargins: bestMargins.rows,
      categories: categories.rows,
      suppliers: suppliers.rows,
    },
    bestSellers: bestSellers.rows,
    bestMargins: bestMargins.rows,
    categories: categories.rows,
  })
}

export default withErrorHandling(handler)

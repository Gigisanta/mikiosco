import { requireRole } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN'])
  if (!user) return
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

export default withErrorHandling(handler)

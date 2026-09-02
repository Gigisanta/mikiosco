import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'
import { withErrorHandling } from './_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'VIEWER'])
  if (!user) return
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

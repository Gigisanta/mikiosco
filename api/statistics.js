import { requireRole, json, methodNotAllowed } from './_lib/auth.js'
import { dbQuery } from './_lib/database.js'

export default async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'VIEWER'])
  if (!user) return
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])

  const months = Math.min(24, Math.max(1, Number(request.query.months || 12)))
  const [monthly, bestSellers, bestMargins, categories] = await Promise.all([
    dbQuery(
      `SELECT date_trunc('month', s.created_at) AS month, SUM(si.total)::numeric AS revenue,
        SUM((si.unit_price - si.unit_cost) * si.quantity)::numeric AS profit,
        COUNT(DISTINCT s.id)::int AS tickets
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' AND s.created_at >= date_trunc('month', now()) - ($2::int - 1) * interval '1 month'
       GROUP BY 1 ORDER BY 1`,
      [user.branchId, months],
    ),
    dbQuery(
      `SELECT si.product_id AS id, si.product_name AS name, SUM(si.quantity)::numeric AS quantity,
        SUM(si.total)::numeric AS revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' GROUP BY 1,2 ORDER BY quantity DESC LIMIT 10`,
      [user.branchId],
    ),
    dbQuery(
      `SELECT si.product_id AS id, si.product_name AS name,
        SUM((si.unit_price-si.unit_cost)*si.quantity)::numeric AS profit,
        CASE WHEN SUM(si.total)>0 THEN SUM((si.unit_price-si.unit_cost)*si.quantity)/SUM(si.total) ELSE 0 END AS margin
       FROM sale_items si JOIN sales s ON s.id=si.sale_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' GROUP BY 1,2 ORDER BY profit DESC LIMIT 10`,
      [user.branchId],
    ),
    dbQuery(
      `SELECT COALESCE(c.name,'Sin categoría') AS category, SUM(si.total)::numeric AS revenue
       FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN products p ON p.id=si.product_id LEFT JOIN categories c ON c.id=p.category_id
       WHERE s.branch_id=$1 AND s.status='COMPLETED' GROUP BY 1 ORDER BY revenue DESC`,
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

import { requireRole } from '../_lib/auth.js'
import { dbQuery } from '../_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from '../_lib/http.js'

async function handler(request, response) {
  const user = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!user) return
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
  const customer = await dbQuery(
    `SELECT id,name,phone,document,credit_limit AS "creditLimit",balance
     FROM customers WHERE id=$1 AND branch_id=$2`,
    [request.query.id, user.branchId],
  )
  if (!customer.rowCount) return json(response, 404, { error: 'Cliente no encontrado.' })
  const movements = await dbQuery(
    `SELECT s.id,'SALE' AS type,s.created_at AS "createdAt",p.amount,s.ticket_number AS "ticketNumber"
     FROM sales s JOIN payments p ON p.sale_id=s.id AND p.method='ACCOUNT'
     WHERE s.customer_id=$1 AND s.status='COMPLETED'
     UNION ALL
     SELECT cap.id,'PAYMENT' AS type,cap.created_at AS "createdAt",cap.amount,NULL AS "ticketNumber"
     FROM customer_account_payments cap WHERE cap.customer_id=$1
     ORDER BY "createdAt" DESC LIMIT 200`,
    [request.query.id],
  )
  return json(response, 200, { customer: customer.rows[0], movements: movements.rows })
}

export default withErrorHandling(handler)

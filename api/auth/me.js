import { requireRole } from '../_lib/auth.js'
import { dbQuery } from '../_lib/database.js'
import { json, methodNotAllowed, withErrorHandling } from '../_lib/http.js'

async function me(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
  const session = await requireRole(request, response, ['ADMIN', 'CASHIER', 'VIEWER'])
  if (!session) return
  const result = await dbQuery(
    `SELECT u.id, u.name, u.email, m.role, b.id AS "branchId", b.name AS "branchName"
     FROM users u JOIN memberships m ON m.user_id=u.id JOIN branches b ON b.id=m.branch_id
     WHERE u.id=$1 AND b.id=$2`,
    [session.id, session.branchId],
  )
  if (!result.rowCount) return json(response, 401, { error: 'La sesión ya no es válida.' })
  return json(response, 200, { user: result.rows[0], csrf: session.csrf })
}

export default withErrorHandling(me)

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { requireRole } from '../_lib/auth.js'
import { dbQuery } from '../_lib/database.js'
import {
  createCsrfToken,
  json,
  methodNotAllowed,
  serializeCookie,
  withErrorHandling,
} from '../_lib/http.js'

async function me(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname.endsWith('/login')) {
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
    if (!process.env.AUTH_SECRET)
      return json(response, 503, { error: 'Autenticación no configurada.' })
    const email = String(request.body?.email || '')
      .trim()
      .toLowerCase()
    const password = String(request.body?.password || '')
    const branchId = request.body?.branchId || null
    if (!email || !password) return json(response, 422, { error: 'Ingresá email y contraseña.' })
    const result = await dbQuery(
      `SELECT u.id,u.name,u.email,u.password_hash AS "passwordHash",
        m.branch_id AS "branchId",m.role,b.name AS "branchName"
       FROM users u JOIN memberships m ON m.user_id=u.id JOIN branches b ON b.id=m.branch_id
       WHERE lower(u.email)=lower($1) AND u.active=true ORDER BY b.name`,
      [email],
    )
    if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].passwordHash))) {
      return json(response, 401, { error: 'Email o contraseña incorrectos.' })
    }
    const memberships = result.rows.map(({ branchId: id, branchName: name, role }) => ({
      id,
      name,
      role,
    }))
    if (!branchId && memberships.length > 1) {
      return json(response, 200, { requiresBranch: true, branches: memberships })
    }
    const selected = result.rows.find(
      (membership) => membership.branchId === (branchId || memberships[0].id),
    )
    if (!selected) return json(response, 403, { error: 'No tenés acceso a esa sucursal.' })
    const csrf = createCsrfToken()
    const token = jwt.sign(
      { id: selected.id, role: selected.role, branchId: selected.branchId, csrf },
      process.env.AUTH_SECRET,
      { expiresIn: '12h', issuer: 'mikiosco.app', audience: 'mikiosco-web' },
    )
    response.setHeader('Set-Cookie', [
      serializeCookie('mikiosco_session', token, { httpOnly: true, maxAge: 43200 }),
      serializeCookie('mikiosco_csrf', csrf, { maxAge: 43200 }),
    ])
    return json(response, 200, {
      user: { id: selected.id, name: selected.name, email: selected.email, role: selected.role },
      branch: { id: selected.branchId, name: selected.branchName },
      csrf,
    })
  }
  if (pathname.endsWith('/logout')) {
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
    response.setHeader('Set-Cookie', [
      serializeCookie('mikiosco_session', '', { httpOnly: true, maxAge: 0 }),
      serializeCookie('mikiosco_csrf', '', { maxAge: 0 }),
    ])
    return json(response, 200, { ok: true })
  }
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

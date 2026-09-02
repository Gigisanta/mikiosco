import jwt from 'jsonwebtoken'
import { json, methodNotAllowed, parseCookies } from './http.js'

export { json, methodNotAllowed }

export async function requireRole(request, response, roles) {
  const cookies = parseCookies(request)
  const token = request.headers.authorization?.replace('Bearer ', '') || cookies.mikiosco_session
  if (!token || !process.env.AUTH_SECRET) {
    json(response, 401, { error: 'Sesión requerida.' })
    return null
  }
  try {
    const user = jwt.verify(token, process.env.AUTH_SECRET, {
      issuer: 'mikiosco.app',
      audience: 'mikiosco-web',
    })
    if (!roles.includes(user.role)) {
      json(response, 403, { error: 'No tenés permiso para esta operación.' })
      return null
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const sentCsrf = request.headers['x-csrf-token']
      if (!sentCsrf || sentCsrf !== cookies.mikiosco_csrf || sentCsrf !== user.csrf) {
        json(response, 403, { error: 'La solicitud no superó la validación de seguridad.' })
        return null
      }
    }
    return user
  } catch {
    json(response, 401, { error: 'Sesión inválida.' })
    return null
  }
}

import jwt from 'jsonwebtoken'
export function json(response, status, body) {
  return response.status(status).json(body)
}
export function methodNotAllowed(response, methods) {
  response.setHeader('Allow', methods)
  return json(response, 405, { error: 'Método no permitido.' })
}
export async function requireRole(request, response, roles) {
  const token =
    request.headers.authorization?.replace('Bearer ', '') || request.cookies?.mikiosco_session
  if (!token || !process.env.AUTH_SECRET) {
    json(response, 401, { error: 'Sesión requerida.' })
    return null
  }
  try {
    const user = jwt.verify(token, process.env.AUTH_SECRET)
    if (!roles.includes(user.role)) {
      json(response, 403, { error: 'No tenés permiso para esta operación.' })
      return null
    }
    return user
  } catch {
    json(response, 401, { error: 'Sesión inválida.' })
    return null
  }
}

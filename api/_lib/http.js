import crypto from 'node:crypto'

export function json(response, status, body) {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

export function methodNotAllowed(response, methods) {
  response.setHeader('Allow', methods)
  return json(response, 405, { error: 'Método no permitido.' })
}

export function parseCookies(request) {
  if (request.cookies) return request.cookies
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key]) => key)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join('='))]),
  )
}

export function createCsrfToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`]
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure !== false) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite || 'Strict'}`)
  return parts.join('; ')
}

export function withErrorHandling(handler) {
  return async function safeHandler(request, response) {
    try {
      return await handler(request, response)
    } catch (error) {
      const status = error.statusCode || 500
      const log = status >= 500 ? console.error : console.warn
      log('Respuesta de API', { status, message: error.message, route: request.url })
      const message =
        status >= 500 ? 'Ocurrió un error interno. Intentá nuevamente.' : error.message
      return json(response, status, { error: message })
    }
  }
}

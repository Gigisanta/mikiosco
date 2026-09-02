import { json, methodNotAllowed, serializeCookie } from '../_lib/http.js'

export default function logout(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
  response.setHeader('Set-Cookie', [
    serializeCookie('mikiosco_session', '', { httpOnly: true, maxAge: 0 }),
    serializeCookie('mikiosco_csrf', '', { maxAge: 0 }),
  ])
  return json(response, 200, { ok: true })
}

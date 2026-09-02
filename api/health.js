export default function handler(_request, response) {
  response
    .status(200)
    .json({ status: 'ok', service: 'mikiosco-api', now: new Date().toISOString() })
}

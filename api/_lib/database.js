import pg from 'pg'

function normalizedConnectionString(value) {
  if (!value) return null
  const url = new URL(value)
  if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    url.searchParams.set('sslmode', 'verify-full')
  }
  return url.toString()
}

const connectionString = normalizedConnectionString(process.env.DATABASE_URL)
const pool = connectionString
  ? new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    })
  : null
export async function dbQuery(text, values) {
  if (!pool) throw new Error('DATABASE_URL no está configurada.')
  return pool.query(text, values)
}
export async function dbTransaction(callback) {
  if (!pool) throw new Error('DATABASE_URL no está configurada.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const value = await callback(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

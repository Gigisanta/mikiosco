import pg from 'pg'
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined }) : null
export async function dbQuery(text, values) { if (!pool) throw new Error('DATABASE_URL no está configurada.'); return pool.query(text, values) }
export async function dbTransaction(callback) { if (!pool) throw new Error('DATABASE_URL no está configurada.'); const client = await pool.connect(); try { await client.query('BEGIN'); const value = await callback(client); await client.query('COMMIT'); return value } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() } }

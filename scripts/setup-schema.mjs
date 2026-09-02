import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.')

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
const databaseUrl = new URL(process.env.DATABASE_URL)
if (['prefer', 'require', 'verify-ca'].includes(databaseUrl.searchParams.get('sslmode'))) {
  databaseUrl.searchParams.set('sslmode', 'verify-full')
}
const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: true },
})

try {
  await pool.query(sql)
  console.log('Esquema de MiKiosco aplicado correctamente.')
} finally {
  await pool.end()
}

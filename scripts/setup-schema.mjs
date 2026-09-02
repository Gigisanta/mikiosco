import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.')

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
})

try {
  await pool.query(sql)
  console.log('Esquema de MiKiosco aplicado correctamente.')
} finally {
  await pool.end()
}

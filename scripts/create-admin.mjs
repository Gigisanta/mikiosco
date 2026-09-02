import bcrypt from 'bcryptjs'
import pg from 'pg'

const required = ['DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  throw new Error(`Faltan variables requeridas: ${missing.join(', ')}`)
}
if (process.env.ADMIN_PASSWORD.length < 10) {
  throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres.')
}

const databaseUrl = new URL(process.env.DATABASE_URL)
if (['prefer', 'require', 'verify-ca'].includes(databaseUrl.searchParams.get('sslmode'))) {
  databaseUrl.searchParams.set('sslmode', 'verify-full')
}
const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: true },
})
const client = await pool.connect()

try {
  await client.query('BEGIN')
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
  const existing = await client.query(
    `SELECT u.id,b.name AS branch_name FROM users u
     LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN branches b ON b.id=m.branch_id
     WHERE lower(u.email)=lower($1) LIMIT 1 FOR UPDATE OF u`,
    [process.env.ADMIN_EMAIL],
  )
  let resultMessage
  if (existing.rowCount) {
    await client.query('UPDATE users SET name=$1,password_hash=$2,active=true WHERE id=$3', [
      process.env.ADMIN_NAME || 'Administrador',
      hash,
      existing.rows[0].id,
    ])
    resultMessage = `Administrador actualizado para ${existing.rows[0].branch_name}.`
  } else {
    const organization = await client.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      [process.env.ORGANIZATION_NAME || 'Mi Kiosco'],
    )
    const branch = await client.query(
      'INSERT INTO branches (organization_id,name) VALUES ($1,$2) RETURNING id',
      [organization.rows[0].id, process.env.BRANCH_NAME || 'Sucursal principal'],
    )
    const user = await client.query(
      'INSERT INTO users (name,email,password_hash) VALUES ($1,lower($2),$3) RETURNING id',
      [process.env.ADMIN_NAME || 'Administrador', process.env.ADMIN_EMAIL, hash],
    )
    await client.query(`INSERT INTO memberships (user_id,branch_id,role) VALUES ($1,$2,'ADMIN')`, [
      user.rows[0].id,
      branch.rows[0].id,
    ])
    await client.query('INSERT INTO branch_ticket_counters (branch_id,next_value) VALUES ($1,1)', [
      branch.rows[0].id,
    ])
    resultMessage = `Administrador creado para ${process.env.BRANCH_NAME || 'Sucursal principal'}.`
  }
  await client.query('COMMIT')
  console.log(resultMessage)
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}

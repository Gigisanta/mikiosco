import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { authApi } from '../lib/api'

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await authApi.login({ email, password, branchId: branchId || undefined })
      if (result.requiresBranch) {
        setBranches(result.branches)
        setBranchId(result.branches[0]?.id || '')
      } else {
        onLogin(result)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark">m</span>
          <span>
            mikiosco<span className="dot">.</span>app
          </span>
        </div>
        <div className="login-icon">
          <LockKeyhole size={22} />
        </div>
        <h1>Entrá a tu kiosco</h1>
        <p>Usá tu usuario para ver la sucursal, caja y stock compartidos.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {branches.length > 0 && (
            <label>
              Sucursal
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} · {branch.role}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={loading}>
            {loading ? 'Ingresando…' : branches.length ? 'Entrar a la sucursal' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}

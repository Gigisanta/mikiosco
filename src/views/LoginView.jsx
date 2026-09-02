import { useState } from 'react'
import {
  BarChart3,
  Eye,
  EyeOff,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  ShoppingBasket,
} from 'lucide-react'
import { authApi } from '../lib/api'

export function LoginView({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      <section className="login-shell" aria-labelledby="login-title">
        <aside className="login-showcase">
          <div className="brand login-brand">
            <span className="brand-mark">m</span>
            <span>
              mikiosco<span className="dot">.</span>app
            </span>
          </div>

          <div className="login-pitch">
            <span className="login-kicker">Gestión simple para tu negocio</span>
            <h1>Todo el kiosco, bajo control.</h1>
            <p>Vendé, controlá el stock y entendé tu negocio desde un solo lugar.</p>
          </div>

          <div className="login-benefits" role="list" aria-label="Beneficios de MiKiosco">
            <div role="listitem">
              <ShoppingBasket size={20} />
              <span>
                <strong>Ventas rápidas</strong>
                Un punto de venta listo para el ritmo del mostrador.
              </span>
            </div>
            <div role="listitem">
              <PackageCheck size={20} />
              <span>
                <strong>Stock siempre visible</strong>
                Mínimos, máximos y reposición sin perder tiempo.
              </span>
            </div>
            <div role="listitem">
              <BarChart3 size={20} />
              <span>
                <strong>Números que se entienden</strong>
                Márgenes y ventas explicados de forma clara.
              </span>
            </div>
          </div>

          <div className="login-trust">
            <ShieldCheck size={17} />
            Tus datos se guardan por sucursal y usuario.
          </div>
        </aside>

        <section className="login-card">
          <div className="brand login-brand login-brand-mobile">
            <span className="brand-mark">m</span>
            <span>
              mikiosco<span className="dot">.</span>app
            </span>
          </div>
          <div className="login-access">
            <div className="login-icon">
              <LockKeyhole size={20} />
            </div>
            <span className="login-access-label">Acceso seguro</span>
          </div>
          <h2 id="login-title">Ingresá a tu espacio</h2>
          <p>Usá tus credenciales para continuar.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Contraseña
              <span className="login-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
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
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Ingresando…' : branches.length ? 'Entrar a la sucursal' : 'Ingresar'}
            </button>
          </form>
          <p className="login-help">¿Necesitás ayuda? Contactá al administrador de tu negocio.</p>
        </section>
      </section>
    </main>
  )
}

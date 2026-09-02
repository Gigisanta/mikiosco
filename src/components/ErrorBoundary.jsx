import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('MiKiosco no pudo renderizar la pantalla', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="fatal-error" role="alert">
        <div>
          <span className="brand-mark">m</span>
          <h1>No pudimos abrir MiKiosco</h1>
          <p>Tus datos siguen guardados. Recargá la aplicación para volver a intentarlo.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </div>
      </main>
    )
  }
}

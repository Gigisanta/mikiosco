export function Metric({ icon, label, value, detail, warning = false }) {
  return (
    <article className="metric">
      <div className={warning ? 'metric-icon warning' : 'metric-icon'}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={warning ? 'warning-text' : ''}>{detail}</small>
    </article>
  )
}

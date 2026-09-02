import { AlertTriangle, Check } from 'lucide-react'

export function Toast({ message }) {
  if (!message) return null
  const isError = message.type === 'error'
  const Icon = isError ? AlertTriangle : Check
  return (
    <div
      className={`toast ${isError ? 'toast-error' : 'toast-success'}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <Icon size={17} aria-hidden="true" />
      {message.text}
    </div>
  )
}

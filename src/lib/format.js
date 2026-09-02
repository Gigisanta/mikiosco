export const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })

export function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

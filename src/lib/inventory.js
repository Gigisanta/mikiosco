import { number } from './format'

export function unitStep(unit) {
  if (['kg', 'litro', 'metro'].includes(unit)) return 0.1
  if (['g', 'ml'].includes(unit)) return 100
  return 1
}

export function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000
}

export function unitLabel(value, unit) {
  const labels = {
    unidad: value === 1 ? 'unidad' : 'unidades',
    kg: 'kg',
    g: 'g',
    litro: value === 1 ? 'litro' : 'litros',
    ml: 'ml',
    pack: value === 1 ? 'pack' : 'packs',
    caja: value === 1 ? 'caja' : 'cajas',
    metro: value === 1 ? 'metro' : 'metros',
  }
  return `${number.format(value)} ${labels[unit] || unit}`
}

export function stockStatus(product) {
  if (product.stock <= 0) return { label: 'Sin stock', level: 'critical' }
  if (product.stock <= product.min) return { label: 'Reponer', level: 'low' }
  if (product.max > 0 && product.stock >= product.max) {
    return { label: 'En el máximo', level: 'high' }
  }
  return { label: 'Stock normal', level: 'ok' }
}

export function marginPercent(product) {
  return product.price ? (product.price - product.cost) / product.price : 0
}

export function calculateChange(total, received) {
  return Math.max(0, roundQuantity(Number(received) - Number(total)))
}

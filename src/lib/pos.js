export function normalizeMoney(value) {
  const number = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

export function calculateChange(received, applied) {
  return Math.max(0, normalizeMoney(normalizeMoney(received) - normalizeMoney(applied)))
}

export function closestTender(total, denomination) {
  const safeTotal = normalizeMoney(total)
  const safeDenomination = normalizeMoney(denomination)
  if (safeDenomination <= 0) return safeTotal
  return Math.ceil(safeTotal / safeDenomination) * safeDenomination
}

export function parseScannerQuery(query, fallbackQuantity = 1) {
  const value = String(query || '').trim()
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*[x*]\s*(.+)$/i)
  if (!match) return { code: value, quantity: Math.max(0, Number(fallbackQuantity) || 1) }
  return {
    code: match[2].trim(),
    quantity: Math.max(0, Number(match[1].replace(',', '.')) || 1),
  }
}

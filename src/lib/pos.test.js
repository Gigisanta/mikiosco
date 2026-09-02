import { describe, expect, it } from 'vitest'
import { calculateChange, closestTender, normalizeMoney, parseScannerQuery } from './pos'

describe('POS', () => {
  it('normaliza importes y calcula vuelto sin negativos', () => {
    expect(normalizeMoney('1250,55')).toBe(1250.55)
    expect(calculateChange(2000, 1750)).toBe(250)
    expect(calculateChange(1000, 1750)).toBe(0)
  })

  it('sugiere el múltiplo de billete inmediato', () => {
    expect(closestTender(6400, 2000)).toBe(8000)
  })

  it('interpreta cantidad por código escaneado', () => {
    expect(parseScannerQuery('3 x 7790895001017')).toEqual({
      code: '7790895001017',
      quantity: 3,
    })
    expect(parseScannerQuery('7790895001017', '0.75')).toEqual({
      code: '7790895001017',
      quantity: 0.75,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { calculateChange, marginPercent, roundQuantity, stockStatus, unitStep } from './inventory'

describe('inventario y cobro', () => {
  it('usa pasos adecuados según la unidad', () => {
    expect(unitStep('unidad')).toBe(1)
    expect(unitStep('kg')).toBe(0.1)
    expect(unitStep('ml')).toBe(100)
  })

  it('redondea cantidades sin errores binarios', () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3)
  })

  it('calcula vuelto sin devolver valores negativos', () => {
    expect(calculateChange(1750, 2000)).toBe(250)
    expect(calculateChange(2000, 1750)).toBe(0)
  })

  it('calcula margen sobre precio de venta', () => {
    expect(marginPercent({ price: 200, cost: 120 })).toBe(0.4)
  })

  it('distingue mínimo, máximo y falta de stock', () => {
    expect(stockStatus({ stock: 0, min: 2, max: 10 }).level).toBe('critical')
    expect(stockStatus({ stock: 2, min: 2, max: 10 }).level).toBe('low')
    expect(stockStatus({ stock: 10, min: 2, max: 10 }).level).toBe('high')
  })
})

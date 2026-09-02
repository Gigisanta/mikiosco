import { describe, expect, it } from 'vitest'
import { normalizeUnit, parseLocaleNumber, parseStockRows } from './excel'

describe('normalización de Excel', () => {
  it.each([
    ['unidades', 'unidad'],
    ['Kilos', 'kg'],
    ['Lts.', 'litro'],
    ['mililitros', 'ml'],
    ['paquetes', 'pack'],
  ])('interpreta %s como %s', (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected)
  })

  it('interpreta precios argentinos con miles y coma decimal', () => {
    expect(parseLocaleNumber('$ 1.250,50')).toBe(1250.5)
  })

  it('acepta alias, conserva códigos y aplica límites', () => {
    const result = parseStockRows([
      ['SKU', 'Descripción', 'Rubro', 'Medida', 'Cantidad', 'Mínimo', 'Máximo', 'Costo', 'Venta'],
      ['00123', 'Yerba suelta', 'Almacén', 'kg', 2.5, 1, 8, '$ 2.500,00', '$ 4.000,00'],
    ])

    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({
      barcode: '00123',
      name: 'Yerba suelta',
      unit: 'kg',
      stock: 2.5,
      min: 1,
      max: 8,
      cost: 2500,
      price: 4000,
    })
  })

  it('informa la fila omitida cuando falta el nombre', () => {
    const result = parseStockRows([
      ['Código', 'Producto', 'Stock'],
      ['ABC', '', 4],
      ['DEF', 'Producto válido', 2],
    ])
    expect(result.items).toHaveLength(1)
    expect(result.errors).toEqual(['Fila 2: falta el nombre del producto.'])
  })
})

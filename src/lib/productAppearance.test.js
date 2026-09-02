import { describe, expect, it } from 'vitest'
import { categoryTone, productInitials } from './productAppearance'

describe('product appearance', () => {
  it('creates stable initials from the product name', () => {
    expect(productInitials('Coca-Cola 500 ml')).toBe('C5')
    expect(productInitials('Energizante')).toBe('E')
  })

  it('uses the same tone for every product in a category', () => {
    expect(categoryTone('Bebidas')).toBe(categoryTone('Bebidas'))
    expect(categoryTone('Bebidas')).toMatch(/^tone-[0-4]$/)
  })
})

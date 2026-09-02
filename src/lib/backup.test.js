import { describe, expect, it } from 'vitest'
import { createDemoBackup } from './backup'

describe('business backup', () => {
  it('creates a versioned and portable payload', () => {
    const backup = createDemoBackup({
      products: [{ id: 1 }],
      sales: [],
      customers: [],
      suppliers: [],
    })
    expect(backup.format).toBe('mikiosco-backup')
    expect(backup.version).toBe(1)
    expect(backup.data.products).toHaveLength(1)
  })
})

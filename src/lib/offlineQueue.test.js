import { describe, expect, it, vi } from 'vitest'
import { enqueueSale, readPendingSales, syncPendingSales } from './offlineQueue'

describe('cola offline', () => {
  it('no duplica una venta con la misma clave', () => {
    const sale = { idempotencyKey: 'd50abca8-f28d-4566-8222-171d08d4cd0e' }
    enqueueSale(sale)
    enqueueSale(sale)
    expect(readPendingSales()).toEqual([sale])
  })

  it('sincroniza en orden y conserva lo pendiente si falla', async () => {
    enqueueSale({ idempotencyKey: 'primera' })
    enqueueSale({ idempotencyKey: 'segunda' })
    const sender = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'))
    const result = await syncPendingSales(sender)
    expect(sender.mock.calls.map(([sale]) => sale.idempotencyKey)).toEqual(['primera', 'segunda'])
    expect(result.pending).toBe(1)
    expect(readPendingSales()).toEqual([{ idempotencyKey: 'segunda' }])
  })
})

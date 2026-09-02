const QUEUE_KEY = 'mikiosco-pending-sales'

export function readPendingSales(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(QUEUE_KEY)) || []
  } catch {
    return []
  }
}

export function enqueueSale(sale, storage = localStorage) {
  const queue = readPendingSales(storage)
  if (!queue.some((item) => item.idempotencyKey === sale.idempotencyKey)) queue.push(sale)
  storage.setItem(QUEUE_KEY, JSON.stringify(queue))
  return queue
}

export async function syncPendingSales(send, storage = localStorage) {
  const queue = readPendingSales(storage)
  let sent = 0
  for (let index = 0; index < queue.length; index += 1) {
    try {
      await send(queue[index])
      sent += 1
      storage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(index + 1)))
    } catch (error) {
      return { sent, pending: queue.length - index, error }
    }
  }
  return { sent, pending: 0, error: null }
}

export function downloadBackup(backup) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `respaldo-mikiosco-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createDemoBackup({ products, sales, customers, suppliers }) {
  return {
    format: 'mikiosco-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    demo: true,
    data: { products, sales, customers, suppliers },
  }
}

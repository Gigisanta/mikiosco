const headerAliases = {
  codigo: ['codigo', 'código', 'barcode', 'sku', 'cod'],
  nombre: ['producto', 'nombre', 'name', 'descripcion', 'descripción'],
  categoria: ['categoria', 'categoría', 'rubro'],
  unidad: ['unidad', 'unidad de medida', 'medida', 'uom'],
  stock: ['stock actual', 'stock', 'cantidad', 'existencia'],
  min: ['stock minimo', 'stock mínimo', 'minimo', 'mínimo'],
  max: ['stock maximo', 'stock máximo', 'maximo', 'máximo'],
  cost: ['costo', 'precio costo', 'precio de costo', 'cost'],
  price: ['precio venta', 'precio de venta', 'venta', 'precio'],
}

const normalizedHeader = value => String(value ?? '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const plainCellValue = value => {
  if (value == null) return ''
  if (typeof value !== 'object') return value
  if ('result' in value) return value.result
  if (Array.isArray(value.richText)) return value.richText.map(part => part.text).join('')
  if ('text' in value) return value.text
  return String(value)
}

function valueFor(row, field) {
  const aliases = headerAliases[field].map(normalizedHeader)
  const key = Object.keys(row).find(candidate => aliases.includes(normalizedHeader(candidate)))
  return key ? row[key] : undefined
}

async function loadExcelEngine() {
  const module = await import('exceljs')
  return module.default || module
}

export function normalizeUnit(value) {
  const unit = normalizedHeader(value).replace(/\./g, '')
  if (['u', 'un', 'unidad', 'unidades', 'unit'].includes(unit)) return 'unidad'
  if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(unit)) return 'kg'
  if (['g', 'gr', 'gramo', 'gramos'].includes(unit)) return 'g'
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(unit)) return 'litro'
  if (['ml', 'mililitro', 'mililitros'].includes(unit)) return 'ml'
  if (['pack', 'packs', 'paquete', 'paquetes'].includes(unit)) return 'pack'
  if (['caja', 'cajas', 'box'].includes(unit)) return 'caja'
  if (['m', 'metro', 'metros'].includes(unit)) return 'metro'
  return 'unidad'
}

const numberValue = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const cleaned = String(value ?? '').replace(/\$/g, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function importStockWorkbook(file) {
  const ExcelJS = await loadExcelEngine()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.getWorksheet('Stock') || workbook.worksheets[0]
  if (!sheet) throw new Error('El archivo no contiene hojas para importar.')

  const headers = []
  sheet.getRow(1).eachCell((cell, column) => { headers[column] = String(plainCellValue(cell.value)).trim() })
  const rows = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const source = sheet.getRow(rowNumber)
    const row = {}
    headers.forEach((header, column) => { if (header) row[header] = plainCellValue(source.getCell(column).value) })
    rows.push(row)
  }

  const items = []
  const errors = []
  rows.forEach((row, index) => {
    const name = String(valueFor(row, 'nombre') ?? '').trim()
    if (!name) {
      if (Object.values(row).some(Boolean)) errors.push(`Fila ${index + 2}: falta el nombre del producto.`)
      return
    }
    const min = Math.max(0, numberValue(valueFor(row, 'min')))
    const max = Math.max(min, numberValue(valueFor(row, 'max'), min))
    items.push({
      barcode: String(valueFor(row, 'codigo') ?? '').replace(/^'/, '').trim(),
      name,
      category: String(valueFor(row, 'categoria') || 'Sin categoría').trim(),
      unit: normalizeUnit(valueFor(row, 'unidad')),
      stock: Math.max(0, numberValue(valueFor(row, 'stock'))),
      min,
      max,
      cost: Math.max(0, numberValue(valueFor(row, 'cost'))),
      price: Math.max(0, numberValue(valueFor(row, 'price'))),
    })
  })

  if (!items.length) throw new Error('No se encontraron productos válidos. Usá la plantilla de MiKiosco.')
  return { items, errors }
}

export async function exportStockWorkbook(products) {
  const ExcelJS = await loadExcelEngine()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MiKiosco'
  const sheet = workbook.addWorksheet('Stock', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    ['Código', 'barcode', 18], ['Producto', 'name', 30], ['Categoría', 'category', 17], ['Unidad', 'unit', 14],
    ['Stock actual', 'stock', 14], ['Stock mínimo', 'min', 14], ['Stock máximo', 'max', 14], ['Costo', 'cost', 14],
    ['Precio venta', 'price', 15], ['Margen $', 'marginAmount', 14], ['Margen %', 'marginPercent', 13], ['Estado', 'status', 15],
  ].map(([header, key, width]) => ({ header, key, width }))

  products.forEach(product => sheet.addRow({
    barcode: product.barcode || '', name: product.name, category: product.category, unit: product.unit,
    stock: product.stock, min: product.min, max: product.max, cost: product.cost, price: product.price,
    marginAmount: product.price - product.cost,
    marginPercent: product.price ? (product.price - product.cost) / product.price : 0,
    status: product.stock <= product.min ? 'REPOSICIÓN' : product.max > 0 && product.stock >= product.max ? 'TOPE' : 'OK',
  }))

  const header = sheet.getRow(1)
  header.height = 25
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087B56' } }
  header.alignment = { vertical: 'middle' }
  sheet.autoFilter = { from: 'A1', to: `L${products.length + 1}` }
  for (let index = 2; index <= products.length + 1; index += 1) {
    sheet.getCell(`A${index}`).numFmt = '@'
    ;['E', 'F', 'G'].forEach(column => { sheet.getCell(`${column}${index}`).numFmt = '0.000' })
    ;['H', 'I', 'J'].forEach(column => { sheet.getCell(`${column}${index}`).numFmt = '$ #,##0.00' })
    sheet.getCell(`K${index}`).numFmt = '0.0%'
  }

  const guide = workbook.addWorksheet('Instrucciones')
  guide.getColumn(1).width = 100
  ;[
    'MiKiosco — Exportación de stock',
    'Podés modificar Stock actual, Stock mínimo, Stock máximo, Costo y Precio venta.',
    'No cambies los encabezados. Al importar, los productos se identifican por Código y luego por nombre.',
    'Unidades válidas: unidad, kg, g, litro, ml, pack, caja y metro.',
  ].forEach((text, index) => { guide.getCell(index + 1, 1).value = text })
  guide.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF087B56' } }

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `stock-mikiosco-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

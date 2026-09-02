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

const normalizedHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function valueFor(row, field) {
  const aliases = headerAliases[field].map(normalizedHeader)
  const key = Object.keys(row).find((candidate) => aliases.includes(normalizedHeader(candidate)))
  return key ? row[key] : undefined
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

export const parseLocaleNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const cleaned = String(value ?? '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function importStockWorkbook(file) {
  const { default: readWorkbook } = await import('read-excel-file/browser')
  const sheets = await readWorkbook(file)
  const data = (sheets.find((sheet) => normalizedHeader(sheet.sheet) === 'stock') || sheets[0])
    ?.data
  if (!data?.length) throw new Error('El archivo no contiene hojas para importar.')

  return parseStockRows(data)
}

export function parseStockRows(data) {
  const headers = data[0].map((value) => String(value ?? '').trim())
  const rows = data
    .slice(1)
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])))
  const items = []
  const errors = []

  rows.forEach((row, index) => {
    const name = String(valueFor(row, 'nombre') ?? '').trim()
    if (!name) {
      if (Object.values(row).some(Boolean))
        errors.push(`Fila ${index + 2}: falta el nombre del producto.`)
      return
    }
    const min = Math.max(0, parseLocaleNumber(valueFor(row, 'min')))
    const max = Math.max(min, parseLocaleNumber(valueFor(row, 'max'), min))
    items.push({
      barcode: String(valueFor(row, 'codigo') ?? '')
        .replace(/^'/, '')
        .trim(),
      name,
      category: String(valueFor(row, 'categoria') || 'Sin categoría').trim(),
      unit: normalizeUnit(valueFor(row, 'unidad')),
      stock: Math.max(0, parseLocaleNumber(valueFor(row, 'stock'))),
      min,
      max,
      cost: Math.max(0, parseLocaleNumber(valueFor(row, 'cost'))),
      price: Math.max(0, parseLocaleNumber(valueFor(row, 'price'))),
    })
  })

  if (!items.length)
    throw new Error('No se encontraron productos válidos. Usá la plantilla de MiKiosco.')
  return { items, errors }
}

const headerCell = (value) => ({
  value,
  fontWeight: 'bold',
  backgroundColor: '#087B56',
  textColor: '#FFFFFF',
  align: 'center',
  height: 26,
})
const numberCell = (value) => ({ value, type: Number, format: '#,##0.000' })
const moneyCell = (value) => ({ value, type: Number, format: '$ #,##0.00' })

export async function exportStockWorkbook(products) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const headings = [
    'Código',
    'Producto',
    'Categoría',
    'Unidad',
    'Stock actual',
    'Stock mínimo',
    'Stock máximo',
    'Costo',
    'Precio venta',
    'Margen $',
    'Margen %',
    'Estado',
  ]
  const stockData = [
    headings.map(headerCell),
    ...products.map((product) => [
      String(product.barcode || ''),
      product.name,
      product.category,
      product.unit,
      numberCell(product.stock),
      numberCell(product.min),
      numberCell(product.max),
      moneyCell(product.cost),
      moneyCell(product.price),
      moneyCell(product.price - product.cost),
      {
        value: product.price ? (product.price - product.cost) / product.price : 0,
        type: Number,
        format: '0.0%',
      },
      product.stock <= product.min
        ? 'REPOSICIÓN'
        : product.max > 0 && product.stock >= product.max
          ? 'TOPE'
          : 'OK',
    ]),
  ]
  const guideData = [
    [
      {
        value: 'MiKiosco | Exportación de stock',
        fontWeight: 'bold',
        fontSize: 16,
        textColor: '#087B56',
      },
    ],
    ['Podés modificar Stock actual, Stock mínimo, Stock máximo, Costo y Precio venta.'],
    [
      'No cambies los encabezados. Al importar, los productos se identifican por Código y luego por nombre.',
    ],
    ['Unidades válidas: unidad, kg, g, litro, ml, pack, caja y metro.'],
  ]
  const columns = [18, 30, 17, 14, 14, 14, 14, 14, 15, 14, 13, 15].map((width) => ({ width }))

  await writeExcelFile([
    { data: stockData, sheet: 'Stock', columns, stickyRowsCount: 1 },
    { data: guideData, sheet: 'Instrucciones', columns: [{ width: 100 }] },
  ]).toFile(`stock-mikiosco-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

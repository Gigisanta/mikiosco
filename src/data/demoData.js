export const DEMO_PRODUCTS = [
  {
    id: 1,
    barcode: '7790895001017',
    name: 'Coca-Cola 500 ml',
    category: 'Bebidas',
    unit: 'unidad',
    price: 1800,
    cost: 1150,
    stock: 24,
    min: 8,
    max: 40,
    sold: 73,
    color: '#f7d7d7',
    emoji: '🥤',
  },
  {
    id: 2,
    barcode: '7790315000446',
    name: 'Agua Villavicencio',
    category: 'Bebidas',
    unit: 'unidad',
    price: 1200,
    cost: 720,
    stock: 18,
    min: 6,
    max: 30,
    sold: 51,
    color: '#d8edf9',
    emoji: '💧',
  },
  {
    id: 3,
    barcode: '7790040122405',
    name: 'Alfajor triple',
    category: 'Golosinas',
    unit: 'unidad',
    price: 1500,
    cost: 830,
    stock: 7,
    min: 8,
    max: 32,
    sold: 89,
    color: '#f4e1c4',
    emoji: '🍪',
  },
  {
    id: 4,
    barcode: '7794520869655',
    name: 'Papas clásicas',
    category: 'Snacks',
    unit: 'unidad',
    price: 2100,
    cost: 1270,
    stock: 11,
    min: 6,
    max: 24,
    sold: 46,
    color: '#f7e5a5',
    emoji: '🥔',
  },
  {
    id: 5,
    barcode: '7792798000722',
    name: 'Cerveza lata',
    category: 'Bebidas',
    unit: 'unidad',
    price: 2200,
    cost: 1420,
    stock: 14,
    min: 12,
    max: 48,
    sold: 62,
    color: '#f9e5ad',
    emoji: '🍺',
  },
  {
    id: 6,
    barcode: '7791293050416',
    name: 'Chicle Beldent',
    category: 'Golosinas',
    unit: 'unidad',
    price: 700,
    cost: 330,
    stock: 4,
    min: 10,
    max: 50,
    sold: 104,
    color: '#dcebc5',
    emoji: '🍬',
  },
  {
    id: 7,
    barcode: '7798119220012',
    name: 'Energizante',
    category: 'Bebidas',
    unit: 'unidad',
    price: 2600,
    cost: 1580,
    stock: 9,
    min: 8,
    max: 24,
    sold: 37,
    color: '#dfd9f2',
    emoji: '⚡',
  },
  {
    id: 8,
    barcode: 'GRANEL-001',
    name: 'Caramelos surtidos',
    category: 'Golosinas',
    unit: 'kg',
    price: 8500,
    cost: 4800,
    stock: 3.5,
    min: 1,
    max: 8,
    sold: 12.4,
    color: '#e6c8ad',
    emoji: '🍬',
  },
]

export function createDemoSales() {
  const payments = ['CASH', 'CARD', 'TRANSFER']
  const sales = []
  for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
    for (let ticket = 0; ticket < 6; ticket += 1) {
      const date = new Date()
      date.setDate(3 + ticket * 4)
      date.setMonth(date.getMonth() - monthOffset)
      date.setHours(9 + ticket, 12, 0, 0)
      const chosen = [
        DEMO_PRODUCTS[(ticket + monthOffset) % DEMO_PRODUCTS.length],
        DEMO_PRODUCTS[(ticket * 2 + monthOffset + 2) % DEMO_PRODUCTS.length],
      ]
      const items = chosen.map((product, index) => {
        const quantity = product.unit === 'kg' ? 0.25 + index * 0.25 : 1 + ((ticket + index) % 3)
        return {
          id: product.id,
          productId: product.id,
          name: product.name,
          category: product.category,
          quantity,
          total: product.price * quantity,
          margin: (product.price - product.cost) * quantity,
        }
      })
      const total = items.reduce((sum, item) => sum + item.total, 0)
      const margin = items.reduce((sum, item) => sum + item.margin, 0)
      sales.push({
        id: `demo-${monthOffset}-${ticket}`,
        ticketNumber: sales.length + 1,
        date: date.toISOString(),
        total,
        subtotal: total,
        discount: 0,
        cost: total - margin,
        payment: payments[ticket % payments.length],
        status: 'COMPLETED',
        items,
      })
    }
  }
  return sales
}

export const PRODUCT_COLORS = ['#d8edf9', '#f4e1c4', '#dcebc5', '#dfd9f2', '#f7d7d7']

export const DEMO_CUSTOMERS = [
  {
    id: 'customer-1',
    name: 'Marina Sosa',
    phone: '11 4820 1934',
    document: '',
    creditLimit: 30000,
    balance: 8400,
    purchaseCount: 4,
  },
  {
    id: 'customer-2',
    name: 'Leo Benítez',
    phone: '11 5931 8072',
    document: '',
    creditLimit: 20000,
    balance: 0,
    purchaseCount: 2,
  },
]

export const DEMO_SUPPLIERS = [
  {
    id: 'supplier-1',
    name: 'Distribuidora del Sur',
    phone: '11 4302 4187',
    email: 'pedidos@delsur.example',
    currentDebt: 0,
  },
]

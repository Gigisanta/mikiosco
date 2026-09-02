const CSRF_KEY = 'mikiosco-csrf'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  const method = options.method || 'GET'
  const headers = { Accept: 'application/json', ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = sessionStorage.getItem(CSRF_KEY)
    if (csrf) headers['X-CSRF-Token'] = csrf
  }
  const response = await fetch(path, {
    ...options,
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(payload.error || 'No se pudo completar la operación.', response.status)
  if (payload.csrf) sessionStorage.setItem(CSRF_KEY, payload.csrf)
  return payload
}

export const authApi = {
  login: (credentials) => apiRequest('/api/auth/login', { method: 'POST', body: credentials }),
  me: () => apiRequest('/api/auth/me'),
  logout: async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    sessionStorage.removeItem(CSRF_KEY)
  },
}

export const businessApi = {
  products: () => apiRequest('/api/products'),
  sales: () => apiRequest('/api/sales?limit=100'),
  createSale: (sale) => apiRequest('/api/sales', { method: 'POST', body: sale }),
  statistics: () => apiRequest('/api/statistics?months=12'),
  cashSession: () => apiRequest('/api/cash-sessions'),
  openCashSession: (openingAmount) =>
    apiRequest('/api/cash-sessions', { method: 'POST', body: { openingAmount } }),
}

export function apiProductToUi(product) {
  return {
    id: product.id,
    barcode: product.barcode || '',
    name: product.name,
    category: product.categoryName || 'Sin categoría',
    unit: product.unit,
    price: Number(product.salePrice),
    cost: Number(product.costPrice),
    stock: Number(product.stock),
    min: Number(product.minStock),
    max: Number(product.maxStock),
    sold: Number(product.sold || 0),
  }
}

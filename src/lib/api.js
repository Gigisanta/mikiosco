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
  backup: () => apiRequest('/api/backup'),
  products: () => apiRequest('/api/products'),
  createProduct: (product) => apiRequest('/api/products', { method: 'POST', body: product }),
  updateProduct: (product) => apiRequest('/api/products', { method: 'PATCH', body: product }),
  deleteProduct: (id) => apiRequest(`/api/products?id=${id}`, { method: 'DELETE' }),
  updatePrices: (change) => apiRequest('/api/prices', { method: 'PATCH', body: change }),
  customers: () => apiRequest('/api/customers'),
  createCustomer: (customer) => apiRequest('/api/customers', { method: 'POST', body: customer }),
  customerDetails: (id) => apiRequest(`/api/customers/${id}`),
  payCustomerAccount: (id, payment) =>
    apiRequest(`/api/customers/${id}/payments`, { method: 'POST', body: payment }),
  suppliers: () => apiRequest('/api/suppliers'),
  createSupplier: (supplier) => apiRequest('/api/suppliers', { method: 'POST', body: supplier }),
  paySupplier: (id, payment) =>
    apiRequest(`/api/suppliers/${id}/payments`, { method: 'POST', body: payment }),
  purchases: () => apiRequest('/api/purchases'),
  createPurchase: (purchase) => apiRequest('/api/purchases', { method: 'POST', body: purchase }),
  updateStock: (items) => apiRequest('/api/stock', { method: 'PATCH', body: { items } }),
  sales: () => apiRequest('/api/sales?limit=100'),
  createSale: (sale) => apiRequest('/api/sales', { method: 'POST', body: sale }),
  statistics: (month = '') =>
    apiRequest(`/api/statistics?months=60${month ? `&month=${encodeURIComponent(month)}` : ''}`),
  cashSession: () => apiRequest('/api/cash-sessions'),
  openCashSession: (openingAmount) =>
    apiRequest('/api/cash-sessions', { method: 'POST', body: { openingAmount } }),
  closeCashSession: (id, closingAmount) =>
    apiRequest('/api/cash-sessions', { method: 'PATCH', body: { id, closingAmount } }),
  expenses: (cashSessionId) => apiRequest(`/api/expenses?cashSessionId=${cashSessionId}`),
  createExpense: (expense) => apiRequest('/api/expenses', { method: 'POST', body: expense }),
  voidSale: (id) => apiRequest(`/api/sales/${id}`, { method: 'DELETE' }),
  returnItems: (id, items, refundMethod = 'CASH') =>
    apiRequest(`/api/sales/${id}`, { method: 'PATCH', body: { items, refundMethod } }),
}

export function apiProductToUi(product) {
  return {
    id: product.id,
    barcode: product.barcode || '',
    name: product.name,
    category: product.categoryName || 'Sin categoría',
    categoryId: product.categoryId || null,
    supplierId: product.supplierId || null,
    unit: product.unit,
    price: Number(product.salePrice),
    cost: Number(product.costPrice),
    stock: Number(product.stock),
    min: Number(product.minStock),
    max: Number(product.maxStock),
    sold: Number(product.sold || 0),
  }
}

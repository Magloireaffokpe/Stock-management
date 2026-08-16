import client from './client'

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
export const authAPI = {
  login:    (data)   => client.post('/auth/login/', data),
  logout:   (data)   => client.post('/auth/logout/', data),
  me:       ()       => client.get('/auth/me/'),
  updateMe: (data)   => client.patch('/auth/me/', data),

  users:       (params) => client.get('/auth/users/', { params }),
  createUser:  (data)   => client.post('/auth/users/', data),
  updateUser:  (id, d)  => client.patch(`/auth/users/${id}/`, d),
  deleteUser:  (id)     => client.delete(`/auth/users/${id}/`),

  activity: (params) => client.get('/auth/activity/', { params }),
}

// ══════════════════════════════════════════════════════════════
//  CATALOGUE
// ══════════════════════════════════════════════════════════════
export const catalogAPI = {
  // Catégories
  categories:       (params) => client.get('/catalog/categories/', { params }),
  categoryTree:     (storeId) => client.get('/catalog/categories/tree/', { params: { store: storeId } }),
  createCategory:   (data)   => client.post('/catalog/categories/', data),
  updateCategory:   (id, d)  => client.patch(`/catalog/categories/${id}/`, d),
  deleteCategory:   (id)     => client.delete(`/catalog/categories/${id}/`),

  // Fournisseurs
  suppliers:       (params) => client.get('/catalog/suppliers/', { params }),
  createSupplier:  (data)   => client.post('/catalog/suppliers/', data),
  updateSupplier:  (id, d)  => client.patch(`/catalog/suppliers/${id}/`, d),
  deleteSupplier:  (id)     => client.delete(`/catalog/suppliers/${id}/`),

  // Produits
  products:       (params) => client.get('/catalog/products/', { params }),
  product:        (id)     => client.get(`/catalog/products/${id}/`),
  createProduct:  (data)   => client.post('/catalog/products/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateProduct:  (id, d)  => client.patch(`/catalog/products/${id}/`, d, {
    headers: data instanceof FormData
      ? { 'Content-Type': 'multipart/form-data' }
      : { 'Content-Type': 'application/json' },
  }),
  deleteProduct:  (id)     => client.delete(`/catalog/products/${id}/`),
  lowStock:       (params) => client.get('/catalog/products/low-stock/', { params }),
  searchProducts: (q)      => client.get('/catalog/products/search/', { params: { q } }),
}

// ══════════════════════════════════════════════════════════════
//  BOUTIQUES
// ══════════════════════════════════════════════════════════════
export const storesAPI = {
  list:   (params) => client.get('/stores/', { params }),
  get:    (id)     => client.get(`/stores/${id}/`),
  create: (data)   => client.post('/stores/', data),
  update: (id, d)  => client.patch(`/stores/${id}/`, d),
  // DELETE intentionnellement absent (bloqué côté API)
}

// Fix updateProduct FormData detection
catalogAPI.updateProduct = (id, data) => client.patch(`/catalog/products/${id}/`, data, {
  headers: data instanceof FormData
    ? { 'Content-Type': 'multipart/form-data' }
    : { 'Content-Type': 'application/json' },
})

// ══════════════════════════════════════════════════════════════
//  VENTES
// ══════════════════════════════════════════════════════════════
export const salesAPI = {
  // Clients
  clients:       (params) => client.get('/sales/clients/', { params }),
  createClient:  (data)   => client.post('/sales/clients/', data),
  updateClient:  (id, d)  => client.patch(`/sales/clients/${id}/`, d),
  deleteClient:  (id)     => client.delete(`/sales/clients/${id}/`),

  // Ventes
  sales:       (params) => client.get('/sales/sales/', { params }),
  sale:        (id)     => client.get(`/sales/sales/${id}/`),
  createSale:  (data)   => client.post('/sales/sales/create/', data),
  cancelSale:  (id)     => client.post(`/sales/sales/${id}/cancel/`),

  // Devis
  quotations:       (params) => client.get('/sales/quotations/', { params }),
  createQuotation:  (data)   => client.post('/sales/quotations/', data),
  updateQuotation:  (id, d)  => client.patch(`/sales/quotations/${id}/`, d),
  convertQuotation: (id, d)  => client.post(`/sales/quotations/${id}/convert/`, d),

  // Réappros
  restocks:      (params) => client.get('/sales/restocks/', { params }),
  restock:       (id)     => client.get(`/sales/restocks/${id}/`),
  createRestock: (data)   => client.post('/sales/restocks/create/', data),
  updateRestock: (id, d)  => client.patch(`/sales/restocks/${id}/`, d),
  deleteRestock: (id)     => client.delete(`/sales/restocks/${id}/`),
}

// ══════════════════════════════════════════════════════════════
//  STOCK
// ══════════════════════════════════════════════════════════════
export const stockAPI = {
  movements:        (params) => client.get('/stock/movements/', { params }),
  productMovements: (id)     => client.get(`/stock/movements/product/${id}/`),
  adjust:           (data)   => client.post('/stock/adjust/', data),

  alerts:         (params) => client.get('/stock/alerts/', { params }),
  alertCount:     ()       => client.get('/stock/alerts/count/'),
  markRead:       (id)     => client.patch(`/stock/alerts/${id}/read/`),
  markAllRead:    ()       => client.post('/stock/alerts/read-all/'),
  resolveAlert:   (id)     => client.patch(`/stock/alerts/${id}/resolve/`),
}

// ══════════════════════════════════════════════════════════════
//  RAPPORTS
// ══════════════════════════════════════════════════════════════
export const reportsAPI = {
  dashboard:      ()       => client.get('/reports/dashboard/'),
  recentSales:    ()       => client.get('/reports/dashboard/recent-sales/'),
  dailyChart:     (days, params = {}) => client.get('/reports/charts/daily/', { params: { days, ...params } }),
  monthlyChart:   (params = {}) => client.get('/reports/charts/monthly/', { params }),
  categoryChart:  (params) => client.get('/reports/charts/categories/', { params }),
  topProducts:    (params) => client.get('/reports/top-products/', { params }),

  // Télécharge la facture PDF avec le token JWT inclus
  invoicePDF: async (id) => {
    try {
      const response = await client.get(`/reports/invoice/${id}/pdf/`, {
        responseType: 'blob',
      })
      const filename = `facture_${id}.pdf`
      downloadBlob(response.data, filename)
      return true
    } catch (err) {
      console.error('Erreur téléchargement PDF:', err)
      throw err
    }
  },

  exportSales:    (params) => client.get('/reports/export/sales/', { params, responseType: 'blob' }),
  exportProducts: (params) => client.get('/reports/export/products/', { params, responseType: 'blob' }),
  exportMovements:(params) => client.get('/reports/export/movements/', { params, responseType: 'blob' }),
}

// ══════════════════════════════════════════════════════════════
//  PARAMÈTRES
// ══════════════════════════════════════════════════════════════
export const settingsAPI = {
  get:          ()     => client.get('/settings/'),
  update:       (data) => client.patch('/settings/', data, {
    headers: data instanceof FormData
      ? { 'Content-Type': 'multipart/form-data' }
      : { 'Content-Type': 'application/json' },
  }),
  exportDB:     ()     => client.get('/settings/backup/export/', { responseType: 'blob' }),
  restoreDB:    (file) => {
    const fd = new FormData()
    fd.append('database', file)
    return client.post('/settings/backup/restore/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  backupList:   () => client.get('/settings/backup/list/'),
  manualBackup: () => client.post('/settings/backup/manual/'),
  auditLogs:    (params) => client.get('/settings/audit/', { params }),
}

// ══════════════════════════════════════════════════════════════
//  UTILITAIRES
// ══════════════════════════════════════════════════════════════
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// Récupère le nom de fichier fourni par le backend (Content-Disposition).
// Ex : "attachment; filename=\"ventes_boutique-alpha_2026-08-16.xlsx\""
export const filenameFromResponse = (res, fallback) => {
  const cd = res?.headers?.['content-disposition']
  if (cd) {
    const match = cd.match(/filename="?([^";]+)"?/)
    if (match?.[1]) return match[1]
  }
  return fallback
}

export const formatCurrency = (amount, currency = 'FCFA') => {
  if (amount == null) return `0 ${currency}`
  return `${Number(amount).toLocaleString('fr-FR')} ${currency}`
}

export const formatDate = (iso, opts = {}) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', ...opts,
    })
  } catch { return '—' }
}

export const formatDatetime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Filter, Edit2, Trash2, Package, ChevronDown,
  Image, Upload, TrendingUp, AlertTriangle, RefreshCw, X
} from 'lucide-react'
import { catalogAPI, formatCurrency } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

const STOCK_STATUS = {
  ok:           { label: 'En stock',  cls: 'badge-ok' },
  low:          { label: 'Faible',    cls: 'badge-low' },
  critical:     { label: 'Critique',  cls: 'badge-critical' },
  out_of_stock: { label: 'Rupture',   cls: 'badge-out' },
}

const CONDITIONS = [
  { value: 'new',         label: 'Neuf' },
  { value: 'used',        label: 'Occasion' },
  { value: 'refurbished', label: 'Reconditionné' },
]

export default function CatalogPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filters, setFilters]       = useState({ category: '', stock_status: '', condition: '' })
  const [page, setPage]             = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal]   = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const PAGE_SIZE = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: PAGE_SIZE,
        ...(search && { search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.stock_status && { stock_status: filters.stock_status }),
        ...(filters.condition && { condition: filters.condition }),
      }
      const res = await catalogAPI.products(params)
      setProducts(res.data?.results ?? [])
      setTotalCount(res.data?.count ?? 0)
    } catch { toast.error('Erreur chargement catalogue') }
    finally { setLoading(false) }
  }, [page, search, filters])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([
      catalogAPI.categories({ active_only: true }),
      catalogAPI.suppliers({ active_only: true }),
    ]).then(([cRes, sRes]) => {
      setCategories(cRes.data?.results ?? cRes.data ?? [])
      setSuppliers(sRes.data?.results ?? sRes.data ?? [])
    })
  }, [])

  const handleDelete = async (product) => {
    if (!confirm(`Désactiver « ${product.name} » ?`)) return
    try {
      await catalogAPI.deleteProduct(product.id)
      toast.success('Produit désactivé')
      load()
    } catch { toast.error('Erreur') }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalogue produits</h1>
          <p className="page-subtitle">{totalCount} produit(s) au total</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}>
            <RefreshCw size={14} />
          </button>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true) }}>
            <Plus size={16} /> Ajouter un produit
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="search-bar">
        <div className="input-wrapper" style={{ flex: 1, maxWidth: 340 }}>
          <Search size={15} className="input-icon" />
          <input
            className="input has-icon"
            placeholder="Rechercher par nom ou SKU…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input" style={{ width: 180 }}
          value={filters.category}
          onChange={e => { setFilters(f => ({ ...f, category: e.target.value })); setPage(1) }}
        >
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" style={{ width: 150 }}
          value={filters.stock_status}
          onChange={e => { setFilters(f => ({ ...f, stock_status: e.target.value })); setPage(1) }}
        >
          <option value="">Tout le stock</option>
          <option value="ok">En stock</option>
          <option value="low">Faible</option>
          <option value="critical">Critique</option>
          <option value="out_of_stock">Rupture</option>
        </select>
        <select className="input" style={{ width: 140 }}
          value={filters.condition}
          onChange={e => { setFilters(f => ({ ...f, condition: e.target.value })); setPage(1) }}
        >
          <option value="">Tout état</option>
          {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {(search || filters.category || filters.stock_status || filters.condition) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilters({ category: '', stock_status: '', condition: '' }); setPage(1) }}>
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <Package size={40} />
              <h3>Aucun produit trouvé</h3>
              <p>Modifiez les filtres ou ajoutez un produit</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>État</th>
                  <th style={{ textAlign: 'right' }}>Prix achat</th>
                  <th style={{ textAlign: 'right' }}>Prix vente</th>
                  <th style={{ textAlign: 'right' }}>Marge</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const ss = STOCK_STATUS[p.stock_status] || STOCK_STATUS.ok
                  return (
                    <tr key={p.id}>
                      <td><span className="td-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.sku}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.condition}</div>
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                          {p.category_name}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {CONDITIONS.find(c => c.value === p.condition)?.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {formatCurrency(p.purchase_price, currency)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700 }}>
                          {formatCurrency(p.selling_price, currency)}
                        </span>
                      </td>
                      <td className="text-right">
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--success)' }}>
                          +{p.margin_percent}%
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span className={`badge ${ss.cls}`}>{ss.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
                            {p.stock_quantity}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => { setEditProduct(p); setShowModal(true) }}
                            data-tooltip="Modifier"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handleDelete(p)}
                            data-tooltip="Désactiver"
                          >
                            <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination" style={{ padding: '12px 22px' }}>
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const pg = page <= 4 ? i + 1 : page - 3 + i
              if (pg < 1 || pg > totalPages) return null
              return (
                <button key={pg} className={`page-btn${page === pg ? ' active' : ''}`} onClick={() => setPage(pg)}>
                  {pg}
                </button>
              )
            })}
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>

      {/* Modal ajout/édition */}
      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          suppliers={suppliers}
          currency={currency}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function ProductModal({ product, categories, suppliers, currency, onClose, onSaved }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || '',
    subcategory: product?.subcategory || '',
    supplier: product?.supplier || '',
    condition: product?.condition || 'new',
    purchase_price: product?.purchase_price || '',
    selling_price: product?.selling_price || '',
    stock_quantity: product?.stock_quantity || 0,
    low_stock_threshold: product?.low_stock_threshold || '',
    description: product?.description || '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving]       = useState(false)
  const margin = form.purchase_price && form.selling_price
    ? (((parseFloat(form.selling_price) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price)) * 100).toFixed(1)
    : null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.category || !form.purchase_price || !form.selling_price) {
      toast.error('Remplissez les champs obligatoires')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v) })
      if (imageFile) fd.append('image', imageFile)

      if (isEdit) {
        await catalogAPI.updateProduct(product.id, fd)
        toast.success('Produit mis à jour')
      } else {
        await catalogAPI.createProduct(fd)
        toast.success('Produit créé')
      }
      onSaved()
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Modifier — ${product.name}` : 'Nouveau produit'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Nom du produit *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: HP Laptop 15s Core i5" />
            </div>
            <div className="input-group">
              <label className="input-label">Catégorie *</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Sélectionner…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Fournisseur</label>
              <select className="input" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                <option value="">Aucun</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Prix d'achat ({currency}) *</label>
              <input className="input" type="number" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} placeholder="0" min={0} />
            </div>
            <div className="input-group">
              <label className="input-label">
                Prix de vente ({currency}) *
                {margin !== null && (
                  <span style={{ marginLeft: 8, color: parseFloat(margin) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                    Marge : {margin}%
                  </span>
                )}
              </label>
              <input className="input" type="number" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0" min={0} />
            </div>
            <div className="input-group">
              <label className="input-label">Stock initial</label>
              <input className="input" type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} min={0} disabled={isEdit} />
              {isEdit && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>Utilisez « Ajustement » pour modifier le stock</p>}
            </div>
            <div className="input-group">
              <label className="input-label">Seuil alerte stock</label>
              <input className="input" type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} placeholder="Par défaut (global)" min={0} />
            </div>
            <div className="input-group">
              <label className="input-label">État</label>
              <select className="input" value={form.condition} onChange={e => set('condition', e.target.value)}>
                {[{ value: 'new', label: 'Neuf' }, { value: 'used', label: 'Occasion' }, { value: 'refurbished', label: 'Reconditionné' }]
                  .map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description optionnelle…" style={{ resize: 'vertical' }} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Image produit</label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', border: '1.5px dashed var(--border)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: 'var(--bg-input)', fontSize: '0.82rem', color: 'var(--text-muted)',
              }}>
                <Upload size={16} />
                {imageFile ? imageFile.name : (product?.image_url ? 'Remplacer l\'image' : 'Choisir une image')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImageFile(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Mettre à jour' : 'Créer le produit')}
          </button>
        </div>
      </div>
    </div>
  )
}

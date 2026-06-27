import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Filter, Edit2, Trash2, Package, ChevronDown,
  Image, Upload, TrendingUp, AlertTriangle, RefreshCw, X, Eye,
  Laptop, Smartphone, Tv, Cpu, HardDrive, Headphones, Gamepad2, Plug, Tag, Folder
} from 'lucide-react'
import { catalogAPI, formatCurrency } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const CATEGORY_ICONS = {
  package: Package,
  laptop: Laptop,
  smartphone: Smartphone,
  tv: Tv,
  cpu: Cpu,
  'hard-drive': HardDrive,
  headphones: Headphones,
  'gamepad-2': Gamepad2,
  plug: Plug,
  tag: Tag,
  folder: Folder,
}

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
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filters, setFilters]       = useState({ category: '', stock_status: '', condition: '' })
  const [page, setPage]             = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal]   = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [pageSize, setPageSize]     = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: pageSize,
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
  }, [page, search, filters, pageSize])

  useEffect(() => { load() }, [load])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await catalogAPI.categories({ active_only: true })
      setCategories(res.data?.results ?? res.data ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchCategories()
    catalogAPI.suppliers({ active_only: true }).then(sRes => {
      setSuppliers(sRes.data?.results ?? sRes.data ?? [])
    })
  }, [fetchCategories])

  const handleDelete = async (product) => {
    if (!confirm(`Désactiver « ${product.name} » ?`)) return
    try {
      await catalogAPI.deleteProduct(product.id)
      toast.success('Produit désactivé')
      load()
    } catch { toast.error('Erreur') }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

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
          <button className="btn btn-outline" onClick={() => setShowCategoryModal(true)}>
            Gérer les catégories
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true) }}>
              <Plus size={16} /> Ajouter un produit
            </button>
          )}
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Par page :</span>
          <select
            className="input"
            style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem' }}
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
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
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                      <td><span className="td-mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.sku}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Link to={`/catalog/${p.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--blue-600)', textDecoration: 'none' }}>
                            {p.name}
                          </Link>
                          {!p.is_active && (
                            <span className="badge badge-grey" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                              Inactif
                            </span>
                          )}
                        </div>
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
                          <Link
                            to={`/catalog/${p.id}`}
                            className="btn btn-ghost btn-icon btn-sm"
                            data-tooltip="Détails"
                          >
                            <Eye size={14} />
                          </Link>
                          {isAdmin && (
                            <>
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
                            </>
                          )}
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
          onRefreshCategories={fetchCategories}
        />
      )}

      {/* Modal gestion des catégories */}
      {showCategoryModal && (
        <CategoryManagerModal
          onClose={() => {
            setShowCategoryModal(false)
            fetchCategories()
          }}
        />
      )}
    </div>
  )
}

function ProductModal({ product, categories, suppliers, currency, onClose, onSaved, onRefreshCategories }) {
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
    is_active: product ? (product.is_active !== false) : true,
  })
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false)

  const handleQuickCategorySaved = async (newCat) => {
    setShowQuickAddCategory(false)
    if (onRefreshCategories) {
      await onRefreshCategories()
    }
    set('category', newCat.id)
  }
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
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="input" style={{ flex: 1 }} value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, padding: 0 }}
                  onClick={() => setShowQuickAddCategory(true)}
                  title="Ajouter rapidement une catégorie"
                >
                  <Plus size={16} />
                </button>
              </div>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => set('is_active', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--blue-600)' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Actif (le produit est visible dans le catalogue et disponible pour les ventes)</span>
              </label>
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
      {showQuickAddCategory && (
        <QuickAddCategoryModal
          onClose={() => setShowQuickAddCategory(false)}
          onSaved={handleQuickCategorySaved}
        />
      )}
    </div>
  )
}

function QuickAddCategoryModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#2563EB')
  const [icon, setIcon] = useState('package')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }
    setSaving(true)
    try {
      const res = await catalogAPI.createCategory({
        name,
        color,
        icon,
        is_active: true,
        order: 0
      })
      toast.success('Catégorie créée')
      onSaved(res.data)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const PRESET_COLORS = [
    '#2563EB', '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
    '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B'
  ]

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">Création rapide de catégorie</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Nom de la catégorie *</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Accessoires"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Couleur</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '2px solid var(--text-primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transform: color === c ? 'scale(1.1)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Icône</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 4 }}>
                {Object.entries(CATEGORY_ICONS).slice(0, 10).map(([key, IconComp]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: icon === key ? 'var(--blue-100)' : 'var(--bg-input)',
                      border: icon === key ? '1.5px solid var(--blue-600)' : '1px solid var(--border)',
                      color: icon === key ? 'var(--blue-700)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <IconComp size={15} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryManagerModal({ onClose }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCategory, setEditCategory] = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#2563EB',
    icon: 'package',
    order: 0,
    is_active: true
  })
  const [saving, setSaving] = useState(false)

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const res = await catalogAPI.categories()
      setCategories(res.data?.results ?? res.data ?? [])
    } catch {
      toast.error('Erreur de chargement des catégories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleEdit = (cat) => {
    setEditCategory(cat)
    setForm({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#2563EB',
      icon: cat.icon || 'package',
      order: cat.order || 0,
      is_active: cat.is_active !== false
    })
    setShowForm(true)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditCategory(null)
    setForm({
      name: '',
      description: '',
      color: '#2563EB',
      icon: 'package',
      order: 0,
      is_active: true
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom de la catégorie est obligatoire')
      return
    }
    setSaving(true)
    try {
      if (editCategory) {
        await catalogAPI.updateCategory(editCategory.id, form)
        toast.success('Catégorie mise à jour')
      } else {
        await catalogAPI.createCategory(form)
        toast.success('Catégorie créée')
      }
      handleCancelForm()
      fetchCategories()
    } catch (e) {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Supprimer la catégorie « ${cat.name} » ? Cette action est irréversible.`)) return
    try {
      await catalogAPI.deleteCategory(cat.id)
      toast.success('Catégorie supprimée')
      fetchCategories()
    } catch {
      toast.error('Impossible de supprimer cette catégorie car elle contient peut-être des produits.')
    }
  }

  const PRESET_COLORS = [
    '#2563EB', '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
    '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B'
  ]

  return (
    <div className="modal-overlay" style={{ zIndex: 105 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <span className="modal-title">Gestion des catégories</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {showForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3>{editCategory ? `Modifier la catégorie : ${editCategory.name}` : 'Nouvelle catégorie'}</h3>
              
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">Nom *</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Électronique"
                  />
                </div>
                
                <div className="input-group">
                  <label className="input-label">Ordre d'affichage</label>
                  <input
                    type="number"
                    className="input"
                    value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle…"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Couleur de la catégorie</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: c,
                        border: form.color === c ? '2.5px solid var(--text-primary)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transform: form.color === c ? 'scale(1.1)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    />
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      style={{
                        width: 32,
                        height: 28,
                        borderRadius: 4,
                        border: '1.5px solid var(--border)',
                        cursor: 'pointer',
                        padding: 1
                      }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      style={{ width: 80, padding: '4px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Icône de la catégorie</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6 }}>
                  {Object.entries(CATEGORY_ICONS).map(([key, IconComp]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icon: key }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: form.icon === key ? 'var(--blue-100)' : 'var(--bg-input)',
                        border: form.icon === key ? '2px solid var(--blue-600)' : '1.5px solid var(--border)',
                        color: form.icon === key ? 'var(--blue-700)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      title={key}
                    >
                      <IconComp size={18} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--blue-600)' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Actif</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn btn-outline" onClick={handleCancelForm}>Annuler</button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <div className="spinner" /> : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{categories.length} catégorie(s) au total</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Nouvelle catégorie
                </button>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div className="spinner" />
                </div>
              ) : categories.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <p>Aucune catégorie configurée.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Icône</th>
                        <th>Nom</th>
                        <th>Ordre</th>
                        <th>Statut</th>
                        <th style={{ width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => {
                        const IconComp = CATEGORY_ICONS[cat.icon] || Package
                        return (
                          <tr key={cat.id} style={{ opacity: cat.is_active ? 1 : 0.5 }}>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: cat.color ? `${cat.color}20` : 'rgba(0,0,0,0.05)',
                                color: cat.color || 'inherit'
                              }}>
                                <IconComp size={16} />
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{cat.name}</div>
                              {cat.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cat.description}</div>}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{cat.order}</td>
                            <td>
                              {cat.is_active ? (
                                <span className="badge badge-ok">Actif</span>
                              ) : (
                                <span className="badge badge-grey">Inactif</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon btn-sm"
                                  onClick={() => handleEdit(cat)}
                                  title="Modifier"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon btn-sm"
                                  onClick={() => handleDelete(cat)}
                                  title="Supprimer"
                                >
                                  <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

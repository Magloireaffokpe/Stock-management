import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, RefreshCw, X, Eye, Edit2, Trash2, Package
} from 'lucide-react'
import { catalogAPI, storesAPI, formatCurrency } from '../../api'
import ProductModal, { flattenCategoryTree } from './ProductModal'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
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
  const isAdmin  = useAuthStore(s => s.isAdmin())

  // Boutiques
  const [stores, setStores]               = useState([])
  const [selectedStore, setSelectedStore] = useState('')

  // Produits
  const [products, setProducts]     = useState([])
  const [catOptions, setCatOptions] = useState([])   // catégories (hiérarchiques) filtrées par boutique
  const [suppliers, setSuppliers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filters, setFilters]       = useState({ category: '', stock_status: '', condition: '' })
  const [page, setPage]             = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize]     = useState(25)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Modales
  const [showModal, setShowModal]     = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [presetStore, setPresetStore] = useState(null)
  const [presetCategory, setPresetCategory] = useState(null)
  const [deleteTarget, setDeleteTarget]         = useState(null)
  const [deletingProduct, setDeletingProduct]   = useState(false)

  // ── Charger les boutiques ────────────────────────────────────
  useEffect(() => {
    storesAPI.list().then(r => setStores(r.data?.results ?? r.data ?? [])).catch(() => {})
  }, [])

  // ── Charger les catégories de la boutique sélectionnée (hiérarchie) ──
  const fetchCatOptions = useCallback(async (storeId) => {
    if (!storeId) { setCatOptions([]); return }
    try {
      const r = await catalogAPI.categoryTree(storeId)
      setCatOptions(flattenCategoryTree(r.data ?? []))
    } catch { setCatOptions([]) }
  }, [])

  useEffect(() => {
    fetchCatOptions(selectedStore)
    setFilters(f => ({ ...f, category: '' }))
    setPage(1)
  }, [selectedStore, fetchCatOptions])

  // ── Charger les fournisseurs ─────────────────────────────────
  useEffect(() => {
    catalogAPI.suppliers({ active_only: true }).then(r => {
      setSuppliers(r.data?.results ?? r.data ?? [])
    }).catch(() => {})
  }, [])

  // ── Charger les produits ─────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: pageSize,
        ...(search            && { search }),
        ...(selectedStore     && { store: selectedStore }),
        ...(filters.category  && { category: filters.category }),
        ...(filters.stock_status && { stock_status: filters.stock_status }),
        ...(filters.condition && { condition: filters.condition }),
      }
      const res = await catalogAPI.products(params)
      setProducts(res.data?.results ?? [])
      setTotalCount(res.data?.count ?? 0)
    } catch { toast.error('Erreur chargement catalogue') }
    finally { setLoading(false) }
  }, [page, search, selectedStore, filters, pageSize])

  useEffect(() => { load() }, [load])

  // ── Helpers ──────────────────────────────────────────────────
  const handleDelete = (product) => setDeleteTarget(product)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingProduct(true)
    try {
      await catalogAPI.deleteProduct(deleteTarget.id)
      toast.success('Produit supprimé')
      setDeleteTarget(null)
      load()
    } catch { toast.error('Erreur lors de la suppression') }
    finally { setDeletingProduct(false) }
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedStore('')
    setFilters({ category: '', stock_status: '', condition: '' })
    setPage(1)
  }

  const hasActiveFilters = !!(search || selectedStore || filters.category || filters.stock_status || filters.condition)

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalogue produits</h1>
          <p className="page-subtitle">{totalCount} produit(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load} title="Rafraîchir">
            <RefreshCw size={14} />
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setEditProduct(null); setPresetStore(null); setPresetCategory(null); setShowModal(true) }}>
              <Plus size={16} /> Nouveau produit
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="search-bar">
        {/* Filtre boutique */}
        <select className="input" style={{ width: 180 }}
          value={selectedStore}
          onChange={e => setSelectedStore(e.target.value)}
        >
          <option value="">Toutes les boutiques</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Filtre catégorie (hiérarchique, limité à la boutique) */}
        <select className="input" style={{ width: 220 }}
          value={filters.category}
          onChange={e => { setFilters(f => ({ ...f, category: e.target.value })); setPage(1) }}
        >
          <option value="">
            {selectedStore ? 'Toutes les catégories' : 'Choisir une boutique d\'abord'}
          </option>
          {catOptions.map(c => (
            <option key={c.id} value={c.id}>
              {'— '.repeat(c.depth)}{c.name}
            </option>
          ))}
        </select>

        <div className="input-wrapper" style={{ flex: 1, maxWidth: 300 }}>
          <Search size={15} className="input-icon" />
          <input
            className="input has-icon"
            placeholder="Rechercher par nom ou SKU…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <select className="input" style={{ width: 140 }}
          value={filters.stock_status}
          onChange={e => { setFilters(f => ({ ...f, stock_status: e.target.value })); setPage(1) }}
        >
          <option value="">Tout le stock</option>
          <option value="ok">En stock</option>
          <option value="low">Faible</option>
          <option value="critical">Critique</option>
          <option value="out_of_stock">Rupture</option>
        </select>

        <select className="input" style={{ width: 130 }}
          value={filters.condition}
          onChange={e => { setFilters(f => ({ ...f, condition: e.target.value })); setPage(1) }}
        >
          <option value="">Tout état</option>
          {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
            <X size={13} /> Réinitialiser
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Par page :</span>
          <select className="input" style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem' }}
            value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
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
                  <th>Boutique</th>
                  <th>Catégorie</th>
                  <th>État</th>
                  <th style={{ textAlign: 'right' }}>Prix vente</th>
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
                          {!p.is_active && <span className="badge badge-grey" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Inactif</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.store_name ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{p.category_name}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {CONDITIONS.find(c => c.value === p.condition)?.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700 }}>
                          {formatCurrency(p.selling_price, currency)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span className={`badge ${ss.cls}`}>{ss.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>{p.stock_quantity}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link to={`/catalog/${p.id}`} className="btn btn-ghost btn-icon btn-sm" data-tooltip="Détails"><Eye size={14} /></Link>
                          {isAdmin && (
                            <>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditProduct(p); setPresetStore(null); setPresetCategory(null); setShowModal(true) }} data-tooltip="Modifier"><Edit2 size={14} /></button>
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(p)} data-tooltip="Supprimer"><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>
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

        {totalPages > 1 && (
          <div className="pagination" style={{ padding: '12px 22px' }}>
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const pg = page <= 4 ? i + 1 : page - 3 + i
              if (pg < 1 || pg > totalPages) return null
              return <button key={pg} className={`page-btn${page === pg ? ' active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
            })}
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>

      {/* Modal ajout/édition produit */}
      {showModal && (
        <ProductModal
          product={editProduct}
          stores={stores}
          suppliers={suppliers}
          currency={currency}
          presetStoreId={presetStore}
          presetCategoryId={presetCategory}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); fetchCatOptions(selectedStore) }}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">Supprimer le produit</span>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>Voulez-vous vraiment supprimer définitivement <strong>{deleteTarget.name}</strong> ?</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Cette action est irréversible et supprimera aussi les données liées au produit.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn" onClick={confirmDelete} disabled={deletingProduct}
                style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}>
                {deletingProduct ? <><div className="spinner" /> Suppression…</> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

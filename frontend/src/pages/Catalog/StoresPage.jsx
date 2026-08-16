import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Store, Edit2, FolderOpen, Package, X, Check } from 'lucide-react'
import { storesAPI, catalogAPI } from '../../api'
import CategoryTree from './CategoryTree'
import ProductModal from './ProductModal'
import QuickAddCategoryModal from './QuickAddCategoryModal'
import useAuthStore from '../../store/authStore'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

export default function StoresPage() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  // Boutique sélectionnée pour l'arborescence
  const [selectedId, setSelectedId] = useState('')

  // Modales
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [editStore, setEditStore] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [presetStore, setPresetStore] = useState(null)
  const [presetCategory, setPresetCategory] = useState(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryModalParent, setCategoryModalParent] = useState(null)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)
  const [suppliers, setSuppliers] = useState([])

  const loadStores = useCallback(async () => {
    setLoading(true)
    try {
      const r = await storesAPI.list()
      const data = r.data?.results ?? r.data ?? []
      setStores(data)
      // Garder une boutique sélectionnée valide (par défaut la première)
      setSelectedId(prev => (data.some(s => String(s.id) === String(prev)) ? prev : (data[0] ? String(data[0].id) : '')))
    } catch { toast.error('Erreur de chargement des boutiques') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStores() }, [loadStores])

  useEffect(() => {
    catalogAPI.suppliers({ active_only: true }).then(r => {
      setSuppliers(r.data?.results ?? r.data ?? [])
    }).catch(() => {})
  }, [])

  const selectedStore = stores.find(s => String(s.id) === String(selectedId))

  // Depuis l'arbre : pré-remplir store + catégorie
  const openProductFromTree = (cat) => {
    setPresetStore(cat.store ?? cat.store_id ?? selectedId)
    setPresetCategory(cat.id)
    setShowProductModal(true)
  }

  const openAddCategoryFromTree = (parentCat) => {
    setCategoryModalParent(parentCat)
    setShowCategoryModal(true)
  }

  const handleStoreSaved = () => {
    setShowStoreModal(false)
    setEditStore(null)
    loadStores()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Boutiques</h1>
          <p className="page-subtitle">Gérez vos boutiques, catégories, sous-catégories et produits</p>
        </div>
        <div className="page-header-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setEditStore(null); setShowStoreModal(true) }}>
              <Plus size={16} /> Nouvelle boutique
            </button>
          )}
        </div>
      </div>

      {/* ── Liste des boutiques ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : stores.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Store size={40} />
            <h3>Aucune boutique</h3>
            <p>{isAdmin ? 'Créez votre première boutique pour commencer' : 'Aucune boutique disponible pour le moment'}</p>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => { setEditStore(null); setShowStoreModal(true) }}>
                <Plus size={14} /> Créer une boutique
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 18 }}>
          {stores.map(s => {
            const isSel = String(s.id) === String(selectedId)
            return (
              <div
                key={s.id}
                className="card"
                onClick={() => setSelectedId(String(s.id))}
                style={{
                  padding: '16px 18px',
                  cursor: 'pointer',
                  borderColor: isSel ? 'var(--blue-600)' : 'var(--border)',
                  borderWidth: isSel ? '2px' : '1px',
                  boxShadow: isSel ? '0 4px 14px rgba(37,99,235,0.15)' : 'none',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: isSel ? 'var(--blue-100)' : 'var(--bg-hover)',
                    color: isSel ? 'var(--blue-600)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Store size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.is_active ? <><Check size={11} style={{ color: 'var(--success)' }} /> Actif</> : <><X size={11} style={{ color: 'var(--danger)' }} /> Inactif</>}
                    </div>
                  </div>
                  {isAdmin && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    title="Modifier la boutique"
                    onClick={e => { e.stopPropagation(); setEditStore(s); setShowStoreModal(true) }}
                  >
                    <Edit2 size={13} />
                  </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <FolderOpen size={12} /> {s.category_count ?? 0} catégorie(s)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Package size={12} /> {s.product_count ?? 0} produit(s)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Arborescence de la boutique sélectionnée ── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Store size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {selectedStore ? selectedStore.name : 'Aucune boutique'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            — catégories, sous-catégories et produits
          </span>
          <div style={{ marginLeft: 'auto' }}>
            {isAdmin && selectedStore && (
              <button className="btn btn-outline btn-sm" onClick={() => openAddCategoryFromTree(null)}>
                <Plus size={13} /> Nouvelle catégorie racine
              </button>
            )}
          </div>
        </div>

        <CategoryTree
          storeId={selectedId || null}
          isAdmin={isAdmin}
          refreshKey={treeRefreshKey}
          onAddProduct={openProductFromTree}
          onAddCategory={openAddCategoryFromTree}
        />
      </div>

      {/* Modal boutique (création / édition) */}
      {showStoreModal && (
        <StoreModal
          store={editStore}
          onClose={() => { setShowStoreModal(false); setEditStore(null) }}
          onSaved={handleStoreSaved}
        />
      )}

      {/* Modal produit */}
      {showProductModal && (
        <ProductModal
          product={null}
          stores={stores}
          suppliers={suppliers}
          currency={currency}
          presetStoreId={presetStore}
          presetCategoryId={presetCategory}
          onClose={() => setShowProductModal(false)}
          onSaved={() => {
            setShowProductModal(false)
            loadStores()
            setTreeRefreshKey(k => k + 1)
          }}
        />
      )}

      {/* Modal catégorie / sous-catégorie */}
      {showCategoryModal && (
        <QuickAddCategoryModal
          stores={stores}
          parentCat={categoryModalParent}
          onClose={() => { setShowCategoryModal(false); setCategoryModalParent(null) }}
          onSaved={() => {
            setShowCategoryModal(false)
            setCategoryModalParent(null)
            setTreeRefreshKey(k => k + 1)
            loadStores()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StoreModal — création / édition d'une boutique
// ─────────────────────────────────────────────────────────────────────────────
function StoreModal({ store, onClose, onSaved }) {
  const isEdit = !!store
  const [name, setName] = useState(store?.name || '')
  const [isActive, setIsActive] = useState(store ? (store.is_active !== false) : true)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), is_active: isActive }
      if (isEdit) {
        await storesAPI.update(store.id, payload)
        toast.success('Boutique mise à jour')
      } else {
        await storesAPI.create(payload)
        toast.success('Boutique créée')
      }
      onSaved()
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Modifier — ${store.name}` : 'Nouvelle boutique'}</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Nom de la boutique *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Boutique 2 — Abidjan" autoFocus />
            </div>
            <div className="input-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--blue-600)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Boutique active</span>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Mettre à jour' : 'Créer la boutique')}
          </button>
        </div>
      </div>
    </div>
  )
}

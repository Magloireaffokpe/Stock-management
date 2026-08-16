import React, { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { catalogAPI } from '../../api'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'new',         label: 'Neuf' },
  { value: 'used',        label: 'Occasion' },
  { value: 'refurbished', label: 'Reconditionné' },
]

// Construit une liste aplatie "indentée" depuis l'arbre des catégories.
export function flattenCategoryTree(nodes, depth = 0) {
  const out = []
  for (const n of nodes || []) {
    out.push({ id: n.id, name: n.name, depth })
    out.push(...flattenCategoryTree(n.children, depth + 1))
  }
  return out
}

export default function ProductModal({
  product, stores, suppliers, currency, onClose, onSaved,
  presetStoreId = null, presetCategoryId = null,
}) {
  const isEdit = !!product

  // Boutique : lecture seule si pré-rempli depuis l'arbre
  const storeIsLocked = !isEdit && presetStoreId != null
  const [storeId, setStoreId] = useState(
    isEdit ? (product.store ?? '') : (presetStoreId ?? '')
  )

  // Catégories hiérarchiques de la boutique choisie
  const [catOptions, setCatOptions] = useState([])
  useEffect(() => {
    if (!storeId) { setCatOptions([]); return }
    catalogAPI.categoryTree(storeId)
      .then(r => setCatOptions(flattenCategoryTree(r.data ?? [])))
      .catch(() => setCatOptions([]))
  }, [storeId])

  const [form, setForm] = useState({
    name: product?.name || '',
    category: isEdit ? (product.category ?? '') : (presetCategoryId ?? ''),
    supplier: product?.supplier || '',
    condition: product?.condition || 'new',
    selling_price: product?.selling_price || '',
    stock_quantity: product?.stock_quantity || 0,
    low_stock_threshold: product?.low_stock_threshold || '',
    description: product?.description || '',
    is_active: product ? (product.is_active !== false) : true,
  })
  const [saving, setSaving] = useState(false)
  // Creatable category state
  const [catInput, setCatInput] = useState('')
  const [showCatCreate, setShowCatCreate] = useState(false)
  const [catCreating, setCatCreating] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Créer une catégorie à la volée (racine)
  const handleCreateCategory = async () => {
    if (!catInput.trim()) return
    if (!storeId) { toast.error('Sélectionnez d\'abord une boutique'); return }

    setCatCreating(true)
    try {
      const res = await catalogAPI.createCategory({ name: catInput.trim(), store: storeId, order: 0 })
      toast.success(`Catégorie « ${catInput.trim()} » créée`)
      const newCat = res.data
      setCatOptions(prev => [...prev, { id: newCat.id, name: newCat.name, depth: 0 }])
      set('category', newCat.id)
      setCatInput('')
      setShowCatCreate(false)
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur création catégorie'
      toast.error(msg)
    } finally { setCatCreating(false) }
  }

  const handleSave = async () => {
    if (!form.name) { toast.error('Le nom est obligatoire'); return }
    if (!storeId && !isEdit) { toast.error('Sélectionnez une boutique'); return }
    if (!form.category) { toast.error('Sélectionnez une catégorie'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v) })
      if (!isEdit && storeId) fd.append('store', storeId)
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
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Modifier — ${product.name}` : 'Nouveau produit'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ marginBottom: 14 }}>

            {/* Nom */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Nom du produit *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: HP Laptop 15s Core i5" autoFocus />
            </div>

            {/* Boutique */}
            <div className="input-group">
              <label className="input-label">Boutique *</label>
              {storeIsLocked ? (
                <div className="input" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {stores.find(s => String(s.id) === String(storeId))?.name || '—'}
                  <span style={{ fontSize: '0.7rem', marginLeft: 8, opacity: 0.6 }}>(pré-rempli)</span>
                </div>
              ) : isEdit ? (
                <div className="input" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {stores.find(s => String(s.id) === String(storeId))?.name || product?.store_name || '—'}
                  <span style={{ fontSize: '0.7rem', marginLeft: 8, opacity: 0.6 }}>(non modifiable)</span>
                </div>
              ) : (
                <select className="input" value={storeId} onChange={e => { setStoreId(e.target.value); set('category', '') }}>
                  <option value="">Sélectionner…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Catégorie — hiérarchique + Creatable */}
            <div className="input-group">
              <label className="input-label">Catégorie *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  disabled={!storeId && !isEdit}
                >
                  <option value="">Sélectionner…</option>
                  {catOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {'— '.repeat(c.depth)}{c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                  onClick={() => setShowCatCreate(v => !v)}
                  title="Créer une catégorie à la volée"
                  disabled={!storeId && !isEdit}
                >
                  <Plus size={13} />
                </button>
              </div>
              {showCatCreate && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="Nom de la nouvelle catégorie racine…"
                    value={catInput}
                    onChange={e => setCatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateCategory} disabled={catCreating || !catInput.trim()}>
                    {catCreating ? <div className="spinner" /> : 'Créer'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowCatCreate(false); setCatInput('') }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Fournisseur */}
            <div className="input-group">
              <label className="input-label">Fournisseur</label>
              <select className="input" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                <option value="">Aucun</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Prix de vente */}
            <div className="input-group">
              <label className="input-label">Prix de vente ({currency}) *</label>
              <input className="input" type="number" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} placeholder="0" min={0} />
            </div>

            {/* Stock */}
            <div className="input-group">
              <label className="input-label">Stock initial</label>
              <input className="input" type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} min={0} />
              {isEdit && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>La modification crée un mouvement de stock (ajustement)</p>}
            </div>

            {/* Seuil alerte */}
            <div className="input-group">
              <label className="input-label">Seuil alerte stock</label>
              <input className="input" type="number" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} placeholder="Par défaut (global)" min={0} />
            </div>

            {/* État */}
            <div className="input-group">
              <label className="input-label">État</label>
              <select className="input" value={form.condition} onChange={e => set('condition', e.target.value)}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Description */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description optionnelle…" style={{ resize: 'vertical' }} />
            </div>

            {/* Actif */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--blue-600)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Actif (visible dans le catalogue et disponible pour les ventes)</span>
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

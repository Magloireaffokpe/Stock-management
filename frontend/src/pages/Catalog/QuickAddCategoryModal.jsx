import React, { useState } from 'react'
import { X } from 'lucide-react'
import { catalogAPI } from '../../api'
import toast from 'react-hot-toast'
import { CATEGORY_ICONS } from './CategoryIcons'

export default function QuickAddCategoryModal({ stores, parentCat, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(parentCat?.color || '#2563EB')
  const [icon, setIcon] = useState(parentCat?.icon || 'package')
  const [storeId, setStoreId] = useState(parentCat?.store ?? parentCat?.store_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Le nom est obligatoire'); return }
    if (!storeId) { toast.error('La boutique est obligatoire'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        store: storeId,
        color, icon,
        is_active: true,
        order: 0,
      }
      if (parentCat) payload.parent = parentCat.id

      const res = await catalogAPI.createCategory(payload)
      toast.success('Catégorie créée')
      onSaved(res.data)
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur lors de la création'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const PRESET_COLORS = [
    '#2563EB', '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
    '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B'
  ]

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">
            {parentCat ? 'Nouvelle sous-catégorie' : 'Nouvelle catégorie racine'}
          </span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {parentCat && (
              <div style={{ fontSize: '0.82rem', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Parent : </span>
                <span style={{ fontWeight: 600 }}>{parentCat.name}</span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Boutique *</label>
              {parentCat ? (
                <div className="input" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {stores.find(s => String(s.id) === String(storeId))?.name || '—'}
                </div>
              ) : (
                <select className="input" value={storeId} onChange={e => setStoreId(e.target.value)}>
                  <option value="">Sélectionner une boutique…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Nom *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Accessoires" autoFocus />
            </div>

            <div className="input-group">
              <label className="input-label">Couleur</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: c,
                      border: color === c ? '2px solid var(--text-primary)' : '1px solid var(--border)',
                      cursor: 'pointer', transform: color === c ? 'scale(1.1)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Icône</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 4 }}>
                {Object.entries(CATEGORY_ICONS).slice(0, 10).map(([key, IconComp]) => (
                  <button key={key} type="button" onClick={() => setIcon(key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32,
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

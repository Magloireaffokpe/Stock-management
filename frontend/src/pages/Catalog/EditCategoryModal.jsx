import React, { useState } from 'react'
import { X } from 'lucide-react'
import { catalogAPI } from '../../api'
import toast from 'react-hot-toast'
import { CATEGORY_ICONS } from './CategoryIcons'

export default function EditCategoryModal({ category, stores, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || '')
  const [color, setColor] = useState(category?.color || '#2563EB')
  const [icon, setIcon] = useState(category?.icon || 'package')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      await catalogAPI.updateCategory(category.id, {
        name: name.trim(),
        color,
        icon,
      })
      toast.success('Catégorie mise à jour')
      onSaved()
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur lors de la mise à jour'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const PRESET_COLORS = [
    '#2563EB', '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
    '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#64748B'
  ]

  const storeName = stores?.find(s => String(s.id) === String(category?.store))?.name || category?.store_name || '—'

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">Modifier — {category?.name}</span>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ fontSize: '0.82rem', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Boutique : </span>
              <span style={{ fontWeight: 600 }}>{storeName}</span>
            </div>

            {category?.parent && (
              <div style={{ fontSize: '0.82rem', padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Parent : </span>
                <span style={{ fontWeight: 600 }}>ID {category.parent}</span>
              </div>
            )}

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
            {saving ? <div className="spinner" /> : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

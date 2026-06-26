import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, X, Truck, Phone, RefreshCw } from 'lucide-react'
import { catalogAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await catalogAPI.suppliers({ page_size: 200, ...(search && { search }) })
      setSuppliers(res.data?.results ?? [])
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fournisseurs</h1>
          <p className="page-subtitle">{suppliers.length} fournisseur(s) enregistré(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setEditSupplier(null); setShowModal(true) }}>
              <Plus size={16} /> Nouveau fournisseur
            </button>
          )}
        </div>
      </div>

      <div className="search-bar">
        <div className="input-wrapper" style={{ flex:1, maxWidth:320 }}>
          <Search size={15} className="input-icon" />
          <input className="input has-icon" placeholder="Nom, téléphone, email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>
      ) : suppliers.length === 0 ? (
        <div className="card"><div className="empty-state"><Truck size={36} /><h3>Aucun fournisseur</h3><p>Ajoutez votre premier fournisseur</p></div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {suppliers.map(s => (
            <div key={s.id} className="card" style={{ padding:'18px 20px', opacity: s.is_active ? 1 : 0.6 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:42, height:42, borderRadius:'50%',
                    background:'linear-gradient(135deg, var(--green-500), var(--blue-500))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', fontSize:'1rem', flexShrink:0,
                  }}>
                    {(s.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {s.name}
                      {!s.is_active && <span className="badge badge-grey" style={{ fontSize: '0.65rem' }}>Inactif</span>}
                    </div>
                    {s.phone && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.78rem', color:'var(--text-muted)', marginTop:2 }}>
                        <Phone size={11} />{s.phone}
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditSupplier(s); setShowModal(true) }}>
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
              <div style={{ display:'flex', gap:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:2 }}>Produits liés</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.85rem' }}>
                    {s.product_count || 0}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal
          supplier={editSupplier}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function SupplierModal({ supplier, onClose, onSaved }) {
  const isEdit = !!supplier
  const [form, setForm] = useState({
    name:      supplier?.name      || '',
    phone:     supplier?.phone     || '',
    whatsapp:  supplier?.whatsapp  || '',
    email:     supplier?.email     || '',
    address:   supplier?.address   || '',
    notes:     supplier?.notes     || '',
    is_active: supplier !== undefined ? supplier?.is_active : true,
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSave = async () => {
    if (!form.name) { toast.error('Le nom est requis'); return }
    setSaving(true)
    try {
      if (isEdit) { await catalogAPI.updateSupplier(supplier.id, form) } 
      else { await catalogAPI.createSupplier(form) }
      toast.success(isEdit ? 'Fournisseur mis à jour' : 'Fournisseur créé')
      onSaved()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="input-group" style={{ marginBottom:12 }}>
            <label className="input-label">Nom du fournisseur *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nom de l'entreprise ou contact" />
          </div>
          <div className="grid-2" style={{ marginBottom:12 }}>
            <div className="input-group"><label className="input-label">Téléphone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+229 97…" /></div>
            <div className="input-group"><label className="input-label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+229 97…" /></div>
          </div>
          <div className="input-group" style={{ marginBottom:12 }}>
            <label className="input-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contact@fournisseur.com" />
          </div>
          <div className="input-group" style={{ marginBottom:12 }}>
            <label className="input-label">Adresse</label>
            <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Adresse physique…" />
          </div>
          <div className="input-group" style={{ marginBottom:12 }}>
            <label className="input-label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes internes…" style={{ resize:'vertical' }} />
          </div>
          {isEdit && (
            <div className="input-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Fournisseur actif
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Mettre à jour' : 'Créer le fournisseur')}
          </button>
        </div>
      </div>
    </div>
  )
}

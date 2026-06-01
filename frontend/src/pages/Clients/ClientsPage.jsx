import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, X, Users, Phone, RefreshCw } from 'lucide-react'
import { salesAPI, formatCurrency } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

export default function ClientsPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const [clients, setClients]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editClient, setEditClient] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await salesAPI.clients({ page_size: 200, ...(search && { search }) })
      setClients(res.data?.results ?? [])
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client(s) enregistré(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => { setEditClient(null); setShowModal(true) }}>
            <Plus size={16} /> Nouveau client
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="input-wrapper" style={{ flex:1, maxWidth:320 }}>
          <Search size={15} className="input-icon" />
          <input className="input has-icon" placeholder="Nom, téléphone…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>
      ) : clients.length === 0 ? (
        <div className="card"><div className="empty-state"><Users size={36} /><h3>Aucun client</h3><p>Ajoutez votre premier client</p></div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {clients.map(c => (
            <div key={c.id} className="card" style={{ padding:'18px 20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:42, height:42, borderRadius:'50%',
                    background:'linear-gradient(135deg, var(--blue-500), var(--orange-500))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', fontSize:'1rem', flexShrink:0,
                  }}>
                    {(c.first_name?.[0] || c.last_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{c.full_name}</div>
                    {c.phone && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.78rem', color:'var(--text-muted)', marginTop:2 }}>
                        <Phone size={11} />{c.phone}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditClient(c); setShowModal(true) }}>
                  <Edit2 size={13} />
                </button>
              </div>
              <div style={{ display:'flex', gap:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:2 }}>Achats</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.85rem' }}>
                    {c.purchases_count || 0}
                  </div>
                </div>
                <div style={{ width:1, background:'var(--border)' }} />
                <div style={{ flex:2, textAlign:'center' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:2 }}>Total dépensé</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.85rem', color:'var(--blue-600)' }}>
                    {formatCurrency(c.total_purchases || 0, currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ClientModal
          client={editClient}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client
  const [form, setForm] = useState({
    first_name: client?.first_name || '',
    last_name:  client?.last_name  || '',
    phone:      client?.phone      || '',
    whatsapp:   client?.whatsapp   || '',
    address:    client?.address    || '',
    notes:      client?.notes      || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSave = async () => {
    if (!form.first_name && !form.last_name) { toast.error('Nom ou prénom requis'); return }
    setSaving(true)
    try {
      if (isEdit) { await salesAPI.updateClient(client.id, form) } else { await salesAPI.createClient(form) }
      toast.success(isEdit ? 'Client mis à jour' : 'Client créé')
      onSaved()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Modifier le client' : 'Nouveau client'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ marginBottom:12 }}>
            <div className="input-group"><label className="input-label">Prénom</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Prénom" /></div>
            <div className="input-group"><label className="input-label">Nom</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Nom de famille" /></div>
            <div className="input-group"><label className="input-label">Téléphone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+229 97…" /></div>
            <div className="input-group"><label className="input-label">WhatsApp</label><input className="input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+229 97…" /></div>
          </div>
          <div className="input-group" style={{ marginBottom:12 }}><label className="input-label">Adresse</label><input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Adresse…" /></div>
          <div className="input-group"><label className="input-label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes internes…" style={{ resize:'vertical' }} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Mettre à jour' : 'Créer le client')}
          </button>
        </div>
      </div>
    </div>
  )
}

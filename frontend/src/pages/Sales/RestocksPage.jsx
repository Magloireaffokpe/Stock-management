import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Eye, X, Package, Pencil, Trash2 } from 'lucide-react'
import { salesAPI, catalogAPI, formatCurrency, formatDate } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function RestocksPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const [restocks, setRestocks] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [detail, setDetail]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await salesAPI.restocks({ page_size: 100, ordering: '-created_at' })
      setRestocks(res.data?.results ?? [])
    } catch { toast.error('Erreur chargement') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setShowModal(true) }
  const openEdit   = (r) => { setDetail(null); setEditing(r); setShowModal(true) }

  const handleDelete = async (r) => {
    if (!confirm(`Supprimer le réapprovisionnement ${r.reference} ?\nLe stock sera diminué des quantités réapprovisionnées.`)) return
    try {
      await salesAPI.deleteRestock(r.id)
      toast.success('Réappro supprimé — stock ajusté')
      if (detail?.id === r.id) setDetail(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erreur suppression')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Réapprovisionnements</h1>
          <p className="page-subtitle">{restocks.length} réappro(s) enregistré(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} /> Nouveau réappro
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner spinner-lg" /></div>
          ) : restocks.length === 0 ? (
            <div className="empty-state"><Package size={36} /><h3>Aucun réappro</h3><p>Créez un réapprovisionnement</p></div>
          ) : (
            <table>
              <thead><tr>
                <th>Référence</th><th>Date</th><th>Fournisseur</th>
                <th style={{textAlign:'center'}}>Qté totale</th>
                <th>Créé par</th><th></th>
              </tr></thead>
              <tbody>
                {restocks.map(r => (
                  <tr key={r.id}>
                    <td><span className="td-mono" style={{ color:'var(--blue-600)', fontSize:'0.82rem' }}>{r.reference}</span></td>
                    <td style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{formatDate(r.restock_date)}</td>
                    <td style={{ fontSize:'0.85rem' }}>{r.supplier_name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign:'center' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>
                        {r.items?.reduce((s, i) => s + i.quantity, 0) || 0}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>{r.created_by_name || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetail(r)} data-tooltip="Détail">
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(r)} data-tooltip="Modifier">
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(r)} data-tooltip="Supprimer">
                              <Trash2 size={14} style={{ color:'var(--danger)' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <RestockModal
          currency={currency}
          restock={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
      {detail && (
        <RestockDetailModal
          restock={detail}
          isAdmin={isAdmin}
          onEdit={() => openEdit(detail)}
          onDelete={() => handleDelete(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function RestockModal({ currency, restock, onClose, onSaved }) {
  const isEdit = Boolean(restock)
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems]         = useState(() =>
    (restock?.items?.length
      ? restock.items.map(i => ({ product_id: i.product, product_name: i.product_name, quantity: i.quantity }))
      : [{ product_id:'', product_name:'', quantity:1 }])
  )
  const [supplierId, setSupplierId] = useState(restock?.supplier ?? '')
  const [date, setDate]           = useState(restock?.restock_date || new Date().toISOString().slice(0,10))
  const [notes, setNotes]         = useState(restock?.notes || '')
  const [saving, setSaving]       = useState(false)
  const [productSearch, setProductSearch] = useState({})
  const [productResults, setProductResults] = useState({})

  useEffect(() => {
    catalogAPI.suppliers({ active_only: true }).then(r => setSuppliers(r.data?.results ?? r.data ?? []))
  }, [])

  const searchProduct = async (idx, q) => {
    setProductSearch(s => ({ ...s, [idx]: q }))
    if (q.length < 2) { setProductResults(r => ({ ...r, [idx]: [] })); return }
    try {
      const res = await catalogAPI.searchProducts(q)
      setProductResults(r => ({ ...r, [idx]: res.data?.results ?? [] }))
    } catch {}
  }

  const selectProduct = (idx, product) => {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, product_id: product.id, product_name: product.name }
      : it
    ))
    setProductSearch(s => ({ ...s, [idx]: '' }))
    setProductResults(r => ({ ...r, [idx]: [] }))
  }

  const clearProduct = (idx) => {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, product_id: '', product_name: '' }
      : it
    ))
    setProductSearch(s => ({ ...s, [idx]: '' }))
  }

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const addItem = () => setItems(prev => [...prev, { product_id:'', product_name:'', quantity:1 }])
  const removeItem = (idx) => setItems(prev => prev.filter((_,i) => i !== idx))

  const handleSave = async () => {
    const valid = items.filter(i => i.product_id && i.quantity > 0)
    if (!valid.length) { toast.error('Ajoutez au moins un produit valide'); return }
    if (!confirm(isEdit
      ? 'Confirmez-vous la modification de ce réapprovisionnement ? Le stock sera ajusté.'
      : 'Confirmez-vous ce réapprovisionnement ? Le stock sera augmenté automatiquement.'
    )) return

    const payload = {
      supplier_id: supplierId || null,
      restock_date: date,
      notes,
      items: valid.map(i => ({
        product_id: i.product_id,
        quantity: parseInt(i.quantity),
      })),
    }

    setSaving(true)
    try {
      if (isEdit) {
        await salesAPI.updateRestock(restock.id, payload)
        toast.success('Réappro modifié — stock ajusté automatiquement')
      } else {
        await salesAPI.createRestock(payload)
        toast.success('Réappro créé — stocks mis à jour automatiquement')
      }
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-xl">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Modifier ${restock.reference}` : 'Nouveau réapprovisionnement'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-3" style={{ marginBottom:16 }}>
            <div className="input-group">
              <label className="input-label">Fournisseur</label>
              <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">Sans fournisseur</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Notes</label>
              <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </div>

          <div style={{ marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:'0.9rem' }}>Produits à réapprovisionner</span>
            <button className="btn btn-outline btn-sm" onClick={addItem}><Plus size={13} /> Ajouter</button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
              <div style={{ flex:3, position:'relative' }}>
                {item.product_id ? (
                  <div style={{ display:'flex', alignItems:'center', background:'var(--bg-input)', padding:'8px 12px', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
                    <span style={{ flex:1, fontSize:'0.85rem', fontWeight:600 }}>{item.product_name}</span>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => clearProduct(idx)}><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <input
                      className="input"
                      placeholder="Rechercher un produit (sélection obligatoire)…"
                      value={productSearch[idx] || ''}
                      onChange={e => searchProduct(idx, e.target.value)}
                    />
                    {(productResults[idx]?.length > 0) ? (
                      <div style={{
                        position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                        background:'white', border:'1px solid var(--border)',
                        borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)',
                        maxHeight:200, overflowY:'auto',
                      }}>
                        {productResults[idx].map(p => (
                          <div key={p.id}
                            onClick={() => selectProduct(idx, p)}
                            style={{ padding:'8px 12px', cursor:'pointer', fontSize:'0.82rem', borderBottom:'1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--blue-50)'}
                            onMouseLeave={e => e.currentTarget.style.background=''}
                          >
                            <strong>{p.name}</strong>
                            <span style={{ color:'var(--text-muted)', marginLeft:8, fontFamily:'var(--font-mono)', fontSize:'0.75rem' }}>
                              Stock: {p.stock_quantity} — Prix: {formatCurrency(p.selling_price, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (productSearch[idx]?.length > 1 && (
                      <div style={{
                        position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                        background:'white', border:'1px solid var(--border)', padding:'10px 12px',
                        borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', fontSize:'0.82rem', color:'var(--danger)'
                      }}>
                        Produit introuvable. Veuillez le créer dans le catalogue d'abord.
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div style={{ flex:1 }}>
                <input className="input" type="number" placeholder="Qté" min={1}
                  value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
              </div>
              {items.length > 1 && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)} style={{ paddingTop:6 }}>
                  <X size={13} style={{ color:'var(--danger)' }} />
                </button>
              )}
            </div>
          ))}

          <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'1rem', color:'var(--text-primary)', marginTop:12 }}>
            {items.filter(i => i.product_id).length} produit(s) — {items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)} unité(s)
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Enregistrer les modifications' : 'Valider le réappro')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestockDetailModal({ restock, isAdmin, onEdit, onDelete, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title" style={{ fontFamily:'var(--font-mono)', color:'var(--blue-600)' }}>{restock.reference}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom:16, fontSize:'0.85rem', color:'var(--text-secondary)' }}>
            <span>Fournisseur : <strong>{restock.supplier_name || '—'}</strong></span> ·{' '}
            <span>Date : <strong>{formatDate(restock.restock_date)}</strong></span> ·{' '}
            <span>Par : <strong>{restock.created_by_name}</strong></span>
          </div>
          <table>
            <thead><tr><th>Produit</th><th style={{textAlign:'center'}}>Qté</th></tr></thead>
            <tbody>
              {restock.items?.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight:600, fontSize:'0.875rem' }}>{item.product_name}</td>
                  <td style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontWeight:700 }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {restock.notes && <p style={{ marginTop:12, fontSize:'0.82rem', color:'var(--text-muted)' }}>Notes : {restock.notes}</p>}
        </div>
        {isAdmin && (
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={() => onDelete(restock)}>
              <Trash2 size={14} /> Supprimer
            </button>
            <button className="btn btn-primary" onClick={() => onEdit(restock)}>
              <Pencil size={14} /> Modifier
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

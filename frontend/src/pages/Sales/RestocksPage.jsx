import React, { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Search, Eye, X, Package } from 'lucide-react'
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
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                <th style={{textAlign:'center'}}>Articles</th>
                <th style={{textAlign:'right'}}>Coût total</th>
                <th>Créé par</th><th></th>
              </tr></thead>
              <tbody>
                {restocks.map(r => (
                  <tr key={r.id}>
                    <td><span className="td-mono" style={{ color:'var(--blue-600)', fontSize:'0.82rem' }}>{r.reference}</span></td>
                    <td style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{formatDate(r.restock_date)}</td>
                    <td style={{ fontSize:'0.85rem' }}>{r.supplier_name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign:'center' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{r.items?.length || 0}</span>
                    </td>
                    <td className="text-right">
                      <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>
                        {formatCurrency(r.total_cost, currency)}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>{r.created_by_name || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDetail(r)} data-tooltip="Détail">
                        <Eye size={14} />
                      </button>
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
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
      {detail && (
        <RestockDetailModal
          restock={detail}
          currency={currency}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function RestockModal({ currency, onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems]         = useState([{ product_id:'', product_name:'', quantity:1, unit_cost:'' }])
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0,10))
  const [notes, setNotes]         = useState('')
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
      ? { ...it, product_id: product.id, product_name: product.name, unit_cost: product.purchase_price }
      : it
    ))
    setProductSearch(s => ({ ...s, [idx]: '' }))
    setProductResults(r => ({ ...r, [idx]: [] }))
  }

  const clearProduct = (idx) => {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, product_id: '', product_name: '', unit_cost: '' }
      : it
    ))
    setProductSearch(s => ({ ...s, [idx]: '' }))
  }

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const addItem = () => setItems(prev => [...prev, { product_id:'', product_name:'', quantity:1, unit_cost:'' }])
  const removeItem = (idx) => setItems(prev => prev.filter((_,i) => i !== idx))

  const total = items.reduce((s,i) => s + (parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0), 0)

  const handleSave = async () => {
    const valid = items.filter(i => i.product_id && i.quantity > 0 && i.unit_cost > 0)
    if (!valid.length) { toast.error('Ajoutez au moins un produit valide'); return }
    if (!confirm('Confirmez-vous ce réapprovisionnement ? Le stock sera augmenté de façon irréversible.')) return
    
    setSaving(true)
    try {
      await salesAPI.createRestock({
        supplier_id: supplierId || null,
        restock_date: date,
        notes,
        items: valid.map(i => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity),
          unit_cost: parseFloat(i.unit_cost),
        })),
      })
      toast.success('Réappro créé — stocks mis à jour automatiquement')
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <span className="modal-title">Nouveau réapprovisionnement</span>
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
                              Stock: {p.stock_quantity} — Achat: {formatCurrency(p.purchase_price, currency)}
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
              <div style={{ flex:1 }}>
                <input className="input" type="number" placeholder={`Prix achat (${currency})`} min={0}
                  value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} />
              </div>
              <div style={{ paddingTop:8, minWidth:80, fontFamily:'var(--font-mono)', fontSize:'0.82rem', fontWeight:700, color:'var(--text-secondary)' }}>
                {formatCurrency((parseFloat(item.unit_cost)||0) * (parseInt(item.quantity)||0), currency)}
              </div>
              {items.length > 1 && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)} style={{ paddingTop:6 }}>
                  <X size={13} style={{ color:'var(--danger)' }} />
                </button>
              )}
            </div>
          ))}

          <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'1rem', color:'var(--text-primary)', marginTop:12 }}>
            Total : {formatCurrency(total, currency)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : 'Valider le réappro'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestockDetailModal({ restock, currency, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
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
            <thead><tr><th>Produit</th><th style={{textAlign:'center'}}>Qté</th><th style={{textAlign:'right'}}>Coût unit.</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
            <tbody>
              {restock.items?.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight:600, fontSize:'0.875rem' }}>{item.product_name}</td>
                  <td style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontWeight:700 }}>{item.quantity}</td>
                  <td className="text-right" style={{ fontFamily:'var(--font-mono)', fontSize:'0.82rem' }}>{formatCurrency(item.unit_cost, currency)}</td>
                  <td className="text-right" style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{formatCurrency(parseFloat(item.unit_cost)*item.quantity, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divider" />
          <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'1rem' }}>
            Total : {formatCurrency(restock.total_cost, currency)}
          </div>
          {restock.notes && <p style={{ marginTop:12, fontSize:'0.82rem', color:'var(--text-muted)' }}>Notes : {restock.notes}</p>}
        </div>
      </div>
    </div>
  )
}

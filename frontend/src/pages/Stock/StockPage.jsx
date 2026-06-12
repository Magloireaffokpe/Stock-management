import React, { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, X, SlidersHorizontal, Plus, AlertTriangle, Download, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { stockAPI, reportsAPI, catalogAPI, formatCurrency, formatDatetime, downloadBlob } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const MOVE_TYPES = {
  sale:'Vente',sale_cancel:'Annulation',restock:'Réappro',
  adjustment:'Ajustement',loss:'Perte/Casse',return:'Retour',initial:'Stock initial',
}
const MOVE_COLORS = {
  sale:'var(--danger)',sale_cancel:'var(--success)',restock:'var(--success)',
  adjustment:'var(--info)',loss:'var(--warning)',return:'var(--blue-500)',initial:'var(--text-muted)',
}

export default function StockPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const [tab, setTab]           = useState('movements')
  const [movements, setMovements] = useState([])
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showAdjust, setShowAdjust] = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [pageSize, setPageSize]     = useState(50)

  const loadMovements = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: pageSize, ordering: '-created_at',
        ...(search && { search }),
        ...(typeFilter && { movement_type: typeFilter }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      }
      const res = await stockAPI.movements(params)
      setMovements(res.data?.results ?? [])
      setTotalCount(res.data?.count ?? 0)
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }, [page, search, typeFilter, pageSize, dateFrom, dateTo])

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await stockAPI.alerts()
      setAlerts(res.data?.results ?? res.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { tab === 'movements' ? loadMovements() : loadAlerts() }, [tab, loadMovements, loadAlerts])

  const markRead = async (id) => {
    await stockAPI.markRead(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
  }

  const resolve = async (id) => {
    await stockAPI.resolveAlert(id)
    setAlerts(prev => prev.filter(a => a.id !== id))
    toast.success('Alerte résolue')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportsAPI.exportMovements()
      downloadBlob(res.data, 'mouvements_stock.xlsx')
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur export') }
    finally { setExporting(false) }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock &amp; Mouvements</h1>
          <p className="page-subtitle">Traçabilité complète de chaque entrée/sortie</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <div className="spinner" /> : <Download size={14} />} Export
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowAdjust(true)}>
              <SlidersHorizontal size={15} /> Ajustement manuel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-card)', borderRadius:'var(--radius-lg)', padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {[
          { key:'movements', label:'Mouvements de stock' },
          { key:'alerts',    label:'Alertes' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1) }} style={{
            padding:'7px 18px', borderRadius:'var(--radius-md)', border:'none', cursor:'pointer',
            fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight:600,
            background: tab===t.key ? 'var(--blue-600)' : 'transparent',
            color: tab===t.key ? '#fff' : 'var(--text-secondary)',
            transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Mouvements */}
      {tab === 'movements' && (
        <>
          <div className="search-bar">
            <div className="input-wrapper" style={{ flex:1, maxWidth:300 }}>
              <Search size={15} className="input-icon" />
              <input className="input has-icon" placeholder="Produit, SKU, référence…"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="input" style={{ width:170 }} value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
              <option value="">Tous types</option>
              {Object.entries(MOVE_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" className="input" style={{ width:136 }}
              value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              title="Date de début" />
            <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', alignSelf:'center' }}>→</span>
            <input type="date" className="input" style={{ width:136 }}
              value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              title="Date de fin" />
            {(search||typeFilter||dateFrom||dateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
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
                {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="table-wrapper">
              {loading ? (
                <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner spinner-lg" /></div>
              ) : movements.length === 0 ? (
                <div className="empty-state"><SlidersHorizontal size={32} /><h3>Aucun mouvement</h3></div>
              ) : (
                <table>
                  <thead><tr>
                    <th>Date</th><th>Produit</th><th>SKU</th><th>Type</th>
                    <th style={{textAlign:'center'}}>Qté</th>
                    <th style={{textAlign:'center'}}>Avant</th>
                    <th style={{textAlign:'center'}}>Après</th>
                    <th>Référence</th><th>Utilisateur</th>
                  </tr></thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDatetime(m.created_at)}</td>
                        <td style={{ fontWeight:600, fontSize:'0.85rem', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.product_name}</td>
                        <td><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)' }}>{m.product_sku}</span></td>
                        <td>
                          <span style={{
                            fontSize:'0.72rem', fontWeight:700, padding:'2px 8px',
                            borderRadius:99, background: MOVE_COLORS[m.movement_type] + '18',
                            color: MOVE_COLORS[m.movement_type],
                          }}>
                            {MOVE_TYPES[m.movement_type] || m.movement_type}
                          </span>
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{
                            fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'0.9rem',
                            color: m.quantity > 0 ? 'var(--success)' : 'var(--danger)',
                          }}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.82rem', color:'var(--text-muted)' }}>{m.stock_before}</td>
                        <td style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.82rem', fontWeight:700 }}>{m.stock_after}</td>
                        <td style={{ fontSize:'0.78rem', fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>
                          {m.reference ? (
                            m.movement_type === 'sale' || m.movement_type === 'sale_cancel' ? (
                              <Link to={`/sales/${m.reference_id || ''}`}
                                style={{ color:'var(--blue-600)', textDecoration:'none', fontFamily:'var(--font-mono)' }}
                                onClick={e => !m.reference_id && e.preventDefault()}
                              >
                                {m.reference}
                              </Link>
                            ) : m.movement_type === 'restock' ? (
                              <span style={{ fontFamily:'var(--font-mono)', color:'var(--success)' }}>{m.reference}</span>
                            ) : (
                              <span>{m.reference}</span>
                            )
                          ) : '—'}
                        </td>
                        <td style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{m.created_by_name || 'Système'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 && (
              <div className="pagination" style={{ padding:'12px 22px' }}>
                <button className="page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>←</button>
                {Array.from({ length: Math.min(7,totalPages) }, (_,i) => {
                  const pg = page<=4 ? i+1 : page-3+i
                  if (pg<1||pg>totalPages) return null
                  return <button key={pg} className={`page-btn${page===pg?' active':''}`} onClick={() => setPage(pg)}>{pg}</button>
                })}
                <button className="page-btn" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>→</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Alertes */}
      {tab === 'alerts' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner spinner-lg" /></div>
          ) : alerts.length === 0 ? (
            <div className="card"><div className="empty-state"><AlertTriangle size={32} /><h3>Aucune alerte active</h3><p>Tous les stocks sont à des niveaux normaux</p></div></div>
          ) : (
            <>
              {isAdmin && (
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
                  <button className="btn btn-outline btn-sm" onClick={async () => { await stockAPI.markAllRead(); loadAlerts(); toast.success('Tout marqué comme lu') }}>
                    Tout marquer comme lu
                  </button>
                </div>
              )}
              {alerts.map(alert => {
                const cfg = {
                  out:      { color:'#991b1b', bg:'#fef2f2', label:'RUPTURE DE STOCK', border:'#fca5a5' },
                  critical: { color:'var(--danger)', bg:'var(--danger-light)', label:'STOCK CRITIQUE', border:'#fca5a5' },
                  low:      { color:'var(--warning)', bg:'var(--warning-light)', label:'STOCK FAIBLE', border:'#fcd34d' },
                }[alert.alert_level] || { color:'var(--text-muted)', bg:'var(--bg-main)', label:'ALERTE', border:'var(--border)' }

                return (
                  <div key={alert.id} style={{
                    background: alert.is_read ? 'var(--bg-card)' : cfg.bg,
                    border: `1.5px solid ${alert.is_read ? 'var(--border)' : cfg.border}`,
                    borderRadius:'var(--radius-lg)', padding:'16px 20px',
                    display:'flex', alignItems:'center', gap:16,
                  }}>
                    <div style={{
                      width:10, height:10, borderRadius:'50%', background:cfg.color, flexShrink:0,
                      boxShadow: alert.alert_level !== 'low' ? `0 0 8px ${cfg.color}` : 'none',
                    }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:2 }}>{alert.product_name}</div>
                      <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                        SKU : <span style={{ fontFamily:'var(--font-mono)' }}>{alert.product_sku}</span> —
                        Stock restant : <strong style={{ color:cfg.color }}>{alert.stock_at_alert} unité(s)</strong>
                      </div>
                    </div>
                    <span style={{
                      fontSize:'0.68rem', fontWeight:800, padding:'3px 10px',
                      background:cfg.color, color:'#fff', borderRadius:99, letterSpacing:0.5,
                    }}>
                      {cfg.label}
                    </span>
                    {!alert.is_read && (
                      <button className="btn btn-outline btn-sm" onClick={() => markRead(alert.id)} style={{ fontSize:'0.75rem' }}>
                        Marquer lu
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-ghost btn-sm" onClick={() => resolve(alert.id)} style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                        Résoudre
                      </button>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {showAdjust && (
        <AdjustmentModal
          currency={currency}
          onClose={() => setShowAdjust(false)}
          onSaved={() => { setShowAdjust(false); loadMovements(); toast.success('Ajustement enregistré') }}
        />
      )}
    </div>
  )
}

function AdjustmentModal({ currency, onClose, onSaved }) {
  const [form, setForm] = useState({ product_id:'', quantity:'', movement_type:'adjustment', note:'' })
  const [productSearch, setProductSearch] = useState('')
  const [results, setResults]   = useState([])
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]     = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const search = async (q) => {
    setProductSearch(q)
    if (q.length < 2) { setResults([]); return }
    const res = await catalogAPI.searchProducts(q)
    setResults(res.data?.results ?? [])
  }

  const select = (p) => { setSelected(p); set('product_id', p.id); setProductSearch(p.name); setResults([]) }

  const handleSave = async () => {
    if (!form.product_id || !form.quantity) { toast.error('Produit et quantité requis'); return }
    if (!confirm(`Voulez-vous vraiment appliquer cet ajustement de stock ? Cette opération est irréversible.`)) return
    
    setSaving(true)
    try {
      await stockAPI.adjust({
        product_id: form.product_id,
        quantity: parseInt(form.quantity),
        movement_type: form.movement_type,
        note: form.note,
      })
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Ajustement de stock</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {selected && (
            <div className="alert-banner info" style={{ marginBottom:14 }}>
              <strong>{selected.name}</strong> — Stock actuel : <strong>{selected.stock_quantity}</strong>
            </div>
          )}
          <div className="input-group" style={{ marginBottom:12, position:'relative' }}>
            <label className="input-label">Produit *</label>
            <input className="input" placeholder="Rechercher…" value={productSearch} onChange={e => search(e.target.value)} />
            {results.length > 0 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'white', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', maxHeight:180, overflowY:'auto' }}>
                {results.map(p => (
                  <div key={p.id} onClick={() => select(p)} style={{ padding:'8px 12px', cursor:'pointer', fontSize:'0.82rem', borderBottom:'1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--blue-50)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}>
                    <strong>{p.name}</strong> <span style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:'0.72rem' }}>({p.stock_quantity} en stock)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid-2" style={{ marginBottom:12 }}>
            <div className="input-group">
              <label className="input-label">Quantité (négatif = sortie)</label>
              <input className="input" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="Ex: -3 ou +5" />
            </div>
            <div className="input-group">
              <label className="input-label">Type</label>
              <select className="input" value={form.movement_type} onChange={e => set('movement_type', e.target.value)}>
                <option value="adjustment">Correction inventaire</option>
                <option value="loss">Perte / Casse</option>
                <option value="return">Retour client</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Motif</label>
            <input className="input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Ex: Inventaire mensuel — 2 unités cassées" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : 'Valider l\'ajustement'}
          </button>
        </div>
      </div>
    </div>
  )
}

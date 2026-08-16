import React, { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, Package, BarChart3, Calendar } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { reportsAPI, storesAPI, formatCurrency, downloadBlob, filenameFromResponse } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

// Palette haute visibilité — couleurs très contrastées entre elles
const COLORS = [
  '#2563EB', // Bleu vif
  '#F97316', // Orange
  '#16A34A', // Vert
  '#DC2626', // Rouge
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#D97706', // Ambre
  '#DB2777', // Rose
  '#065F46', // Vert foncé
  '#92400E', // Marron
]

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0D1B33', borderRadius:10, padding:'10px 14px', boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
      <p style={{ color:'#94AECF', fontSize:'0.72rem', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize:'0.82rem', fontWeight:700 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? formatCurrency(p.value, currency) : p.value}
        </p>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload, currency, total }) => {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
  return (
    <div style={{ background:'#0D1B33', borderRadius:10, padding:'10px 16px', boxShadow:'0 8px 24px rgba(0,0,0,0.35)', minWidth:170 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:item.payload.fill, flexShrink:0 }} />
        <span style={{ color:'#fff', fontSize:'0.82rem', fontWeight:700 }}>{item.name}</span>
      </div>
      <div style={{ color:'#4ADE80', fontSize:'0.85rem', fontWeight:800 }}>{formatCurrency(item.value, currency)}</div>
      <div style={{ color:'#94AECF', fontSize:'0.75rem', marginTop:2 }}>{pct}% du CA total</div>
    </div>
  )
}

export default function ReportsPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const [tab, setTab]           = useState('overview')
  const [monthly, setMonthly]   = useState([])
  const [daily, setDaily]       = useState([])
  const [topProds, setTopProds] = useState([])
  const [catData, setCatData]   = useState([])
  const [days, setDays]         = useState(30)
  const [loading, setLoading]   = useState(true)
  const [storeFilter, setStoreFilter] = useState(() => localStorage.getItem('reports_store_filter') || '')
  const [stores, setStores] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [exporting, setExporting] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { 
        ...(dateFrom && { date_from: dateFrom }), 
        ...(dateTo && { date_to: dateTo }),
        ...(storeFilter && { store: storeFilter })
      }
      const [mo, da, top, cat] = await Promise.all([
        reportsAPI.monthlyChart(params),
        reportsAPI.dailyChart(days, params),
        reportsAPI.topProducts({ ...params, limit: 10 }),
        reportsAPI.categoryChart(params),
      ])
      setMonthly(mo.data)
      setDaily(da.data)
      setTopProds(top.data)
      setCatData(cat.data)
    } catch { toast.error('Erreur chargement rapports') }
    finally { setLoading(false) }
  }, [days, dateFrom, dateTo, storeFilter])

  useEffect(() => {
    storesAPI.list().then(res => setStores(res.data?.results ?? res.data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  const handleStoreChange = (val) => {
    setStoreFilter(val)
    if (val) localStorage.setItem('reports_store_filter', val)
    else localStorage.removeItem('reports_store_filter')
  }

  const handleExport = async (type) => {
    setExporting(type)
    try {
      const params = { 
        ...(dateFrom && { date_from: dateFrom }), 
        ...(dateTo && { date_to: dateTo }),
        ...(storeFilter && { store: storeFilter })
      }
      let res, filename
      if (type === 'sales')    { res = await reportsAPI.exportSales(params);    filename = 'ventes.xlsx' }
      if (type === 'products') { res = await reportsAPI.exportProducts(params);  filename = 'produits.xlsx' }
      if (type === 'movements'){ res = await reportsAPI.exportMovements(params); filename = 'mouvements_stock.xlsx' }
      downloadBlob(res.data, filenameFromResponse(res, filename))
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur export') }
    finally { setExporting('') }
  }

  const TABS = ['overview','products']
  const TAB_LABELS = { overview:'Vue d\'ensemble', products:'Top produits' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports &amp; Analyses</h1>
          <p className="page-subtitle">Données en temps réel</p>
        </div>
        <div className="page-header-actions">
          <select className="input" style={{ width: 180 }} value={storeFilter} onChange={e => handleStoreChange(e.target.value)}>
            <option value="">Toutes les boutiques</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Calendar size={14} style={{ color:'var(--text-muted)' }} />
            <input type="date" className="input" style={{ width:136 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>→</span>
            <input type="date" className="input" style={{ width:136 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}><RefreshCw size={14} /></button>
          <div style={{ display:'flex', gap:6 }}>
            {[['sales','Ventes'],['products','Produits'],['movements','Mouvements']].map(([t,l]) => (
              <button key={t} className="btn btn-outline btn-sm" onClick={() => handleExport(t)} disabled={exporting===t}>
                {exporting===t ? <div className="spinner" /> : <Download size={13} />} {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-card)', borderRadius:'var(--radius-lg)', padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'7px 18px', borderRadius:'var(--radius-md)', border:'none', cursor:'pointer',
            fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight:600,
            background: tab===t ? 'var(--blue-600)' : 'transparent',
            color: tab===t ? '#fff' : 'var(--text-secondary)', transition:'all 0.15s',
          }}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <>
          {/* ── VUE D'ENSEMBLE ─── */}
          {tab === 'overview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {/* Filtres jours */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>Période journalière :</span>
                {[7,14,30,90].map(d => (
                  <button key={d} onClick={() => setDays(d)} style={{
                    padding:'4px 12px', borderRadius:'var(--radius-sm)', border:'1.5px solid',
                    borderColor: days===d ? 'var(--blue-500)' : 'var(--border)',
                    background: days===d ? 'var(--blue-100)' : 'transparent',
                    color: days===d ? 'var(--blue-600)' : 'var(--text-secondary)',
                    fontWeight:600, fontSize:'0.8rem', cursor:'pointer',
                  }}>{d}j</button>
                ))}
              </div>

              {/* Graphique journalier */}
              <div className="card">
                <div className="card-header"><span className="card-title">CA journalier — {days} derniers jours</span></div>
                <div className="card-body" style={{ paddingTop:8 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={daily} barSize={daily.length > 20 ? 12 : 28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={d => { const [,m,day]=d.split('-'); return `${day}/${m}` }}
                        tick={{ fontSize:10, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v}
                        tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill:'var(--blue-50)' }} />
                      <Bar dataKey="revenue" name={`CA (${currency})`} fill="var(--blue-500)" radius={[4,4,0,0]}>
                        {daily.map((e,i) => <Cell key={i} fill={e.is_today?'var(--orange-500)':'var(--blue-500)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Graphique mensuel */}
              <div className="card">
                <div className="card-header"><span className="card-title">Évolution mensuelle — 12 mois</span></div>
                <div className="card-body" style={{ paddingTop:8 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:v} tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip currency={currency} />} />
                      <Line type="monotone" dataKey="revenue" name={`CA (${currency})`} stroke="var(--blue-500)" strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:20 }}>
                {/* Répartition catégories */}
                <div className="card">
                  <div className="card-header"><span className="card-title">CA par catégorie</span></div>
                  <div className="card-body">
                    {catData.length === 0 ? (
                      <div className="empty-state" style={{ padding:'20px 10px' }}><BarChart3 size={28} /><p>Aucune vente</p></div>
                    ) : (() => {
                      const catTotal = catData.reduce((s, d) => s + (d.total_revenue || 0), 0)
                      return (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={catData}
                                dataKey="total_revenue"
                                nameKey="product__category__name"
                                cx="50%" cy="50%"
                                innerRadius={45} outerRadius={75}
                                paddingAngle={3}
                                strokeWidth={2}
                                stroke="var(--bg-card)"
                              >
                                {catData.map((entry, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<PieTooltip currency={currency} total={catTotal} />} />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Légende manuelle avec valeurs exactes */}
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {catData.map((d, i) => {
                              const pct = catTotal > 0 ? ((d.total_revenue / catTotal) * 100).toFixed(1) : 0
                              return (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.78rem' }}>
                                  <div style={{ width:10, height:10, borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0 }} />
                                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-secondary)' }}>
                                    {d.product__category__name || 'Sans catégorie'}
                                  </span>
                                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--text-primary)', flexShrink:0 }}>
                                    {formatCurrency(d.total_revenue, currency)}
                                  </span>
                                  <span style={{ fontFamily:'var(--font-mono)', color:'var(--text-muted)', flexShrink:0, minWidth:36, textAlign:'right' }}>
                                    {pct}%
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TOP PRODUITS ─── */}
          {tab === 'products' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Top 10 produits les plus vendus</span></div>
              <div className="table-wrapper">
                {topProds.length === 0 ? (
                  <div className="empty-state"><Package size={36} /><h3>Aucune vente enregistrée</h3></div>
                ) : (
                  <table>
                    <thead><tr>
                      <th>#</th><th>Produit</th><th>Catégorie</th>
                      <th style={{textAlign:'center'}}>Qté vendue</th>
                      <th style={{textAlign:'right'}}>CA total</th>
                    </tr></thead>
                    <tbody>
                      {topProds.map((p, idx) => (
                        <tr key={p.product__id}>
                          <td>
                            <span style={{
                              fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'0.9rem',
                              color: idx===0?'var(--orange-500)':idx===1?'var(--text-secondary)':idx===2?'var(--warning)':'var(--text-muted)',
                            }}>#{idx+1}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{p.product__name}</div>
                            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{p.product__sku}</div>
                          </td>
                          <td><span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>{p.product__category__name}</span></td>
                          <td style={{ textAlign:'center' }}><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{p.total_qty}</span></td>
                          <td className="text-right"><span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{formatCurrency(p.total_revenue, currency)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

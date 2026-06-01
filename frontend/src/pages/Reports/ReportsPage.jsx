import React, { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, TrendingUp, Package, BarChart3, Calendar } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { reportsAPI, formatCurrency, downloadBlob } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

const COLORS = ['#1A52A0','#F06820','#16A34A','#7C3AED','#0891B2','#D97706','#DC2626','#0D9488']

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

export default function ReportsPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const [tab, setTab]           = useState('overview')
  const [monthly, setMonthly]   = useState([])
  const [daily, setDaily]       = useState([])
  const [topProds, setTopProds] = useState([])
  const [catData, setCatData]   = useState([])
  const [payData, setPayData]   = useState([])
  const [stockVal, setStockVal] = useState(null)
  const [days, setDays]         = useState(30)
  const [loading, setLoading]   = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [exporting, setExporting] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) }
      const [mo, da, top, cat, pay, sv] = await Promise.all([
        reportsAPI.monthlyChart(),
        reportsAPI.dailyChart(days),
        reportsAPI.topProducts({ ...params, limit: 10 }),
        reportsAPI.categoryChart(params),
        reportsAPI.paymentMethods(params),
        reportsAPI.stockValue(),
      ])
      setMonthly(mo.data)
      setDaily(da.data)
      setTopProds(top.data)
      setCatData(cat.data)
      setPayData(pay.data)
      setStockVal(sv.data)
    } catch { toast.error('Erreur chargement rapports') }
    finally { setLoading(false) }
  }, [days, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const handleExport = async (type) => {
    setExporting(type)
    try {
      const params = { ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) }
      let res, filename
      if (type === 'sales')    { res = await reportsAPI.exportSales(params);    filename = 'ventes.xlsx' }
      if (type === 'products') { res = await reportsAPI.exportProducts(params);  filename = 'produits.xlsx' }
      if (type === 'movements'){ res = await reportsAPI.exportMovements(params); filename = 'mouvements.xlsx' }
      downloadBlob(res.data, filename)
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur export') }
    finally { setExporting('') }
  }

  const TABS = ['overview','products','stock']
  const TAB_LABELS = { overview:'Vue d\'ensemble', products:'Top produits', stock:'Valeur du stock' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports &amp; Analyses</h1>
          <p className="page-subtitle">Données en temps réel</p>
        </div>
        <div className="page-header-actions">
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
                      <Line type="monotone" dataKey="profit" name={`Bénéfice (${currency})`} stroke="var(--success)" strokeWidth={2} dot={false} strokeDasharray="5 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {/* Répartition catégories */}
                <div className="card">
                  <div className="card-header"><span className="card-title">CA par catégorie</span></div>
                  <div className="card-body">
                    {catData.length === 0 ? (
                      <div className="empty-state" style={{ padding:'20px 10px' }}><BarChart3 size={28} /><p>Aucune vente</p></div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={catData} dataKey="total_revenue" nameKey="product__category__name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                            {catData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatCurrency(v, currency)} contentStyle={{ background:'#0D1B33', border:'none', borderRadius:10, fontSize:'0.8rem', color:'#fff' }} />
                          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize:'0.75rem' }} formatter={v => v?.length > 18 ? v.slice(0,17)+'…' : v} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Méthodes de paiement */}
                <div className="card">
                  <div className="card-header"><span className="card-title">Modes de paiement</span></div>
                  <div className="card-body">
                    {payData.length === 0 ? (
                      <div className="empty-state" style={{ padding:'20px 10px' }}><p>Aucune donnée</p></div>
                    ) : (
                      <>
                        {payData.map((p,i) => {
                          const maxVal = Math.max(...payData.map(x => x.total || 0))
                          const pct = maxVal > 0 ? ((p.total||0) / maxVal * 100) : 0
                          const labels = { cash:'Espèces',mtn:'MTN MoMo',moov:'Moov',card:'Carte',transfer:'Virement',mixed:'Mixte' }
                          return (
                            <div key={i} style={{ marginBottom:12 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:'0.82rem' }}>
                                <span style={{ fontWeight:600 }}>{labels[p.payment_method] || p.payment_method}</span>
                                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-muted)' }}>
                                  {p.count} vente(s) — {formatCurrency(p.total, currency)}
                                </span>
                              </div>
                              <div style={{ height:6, background:'var(--bg-main)', borderRadius:99, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:COLORS[i%COLORS.length], borderRadius:99, transition:'width 0.5s ease' }} />
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
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
                      <th style={{textAlign:'right'}}>Bénéfice</th>
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
                          <td className="text-right"><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success)' }}>+{formatCurrency(p.total_margin, currency)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── VALEUR STOCK ─── */}
          {tab === 'stock' && stockVal && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
                {[
                  { label:'Valeur d\'achat totale', value: formatCurrency(stockVal.purchase_value, currency), color:'var(--info)', bg:'var(--info-light)' },
                  { label:'Valeur de vente totale', value: formatCurrency(stockVal.selling_value, currency), color:'var(--blue-600)', bg:'var(--blue-100)' },
                  { label:'Bénéfice potentiel', value: formatCurrency(stockVal.potential_profit, currency), color:'var(--success)', bg:'var(--success-light)' },
                  { label:'Produits actifs', value: stockVal.total_products, color:'var(--orange-500)', bg:'var(--orange-100)' },
                  { label:'Unités en stock', value: stockVal.total_units, color:'var(--navy-800)', bg:'var(--blue-50)' },
                ].map(card => (
                  <div key={card.label} className="card" style={{ padding:'20px 22px' }}>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:0.8, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8 }}>{card.label}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:800, color:card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>
              <div className="alert-banner info">
                <TrendingUp size={16} />
                Le bénéfice potentiel représente la marge si tout le stock actuel est vendu au prix catalogue.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

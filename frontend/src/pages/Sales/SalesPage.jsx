import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, Eye, XCircle, Download, RefreshCw,
  Receipt, X, Calendar
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { salesAPI, reportsAPI, formatCurrency, formatDatetime, downloadBlob } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const PAYMENT_LABELS = {
  cash:'Espèces', mtn:'MTN MoMo', moov:'Moov Money',
  celtiis:'Celtiis Money', card:'Carte', transfer:'Virement', mixed:'Mixte',
}

export default function SalesPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const navigate = useNavigate()
  const [sales, setSales]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [pageSize, setPageSize]   = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, page_size: pageSize, ordering: '-created_at',
        ...(search && { search }),
        ...(payFilter && { payment_method: payFilter }),
        ...(statusFilter !== '' && { is_cancelled: statusFilter }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo   && { date_to: dateTo }),
      }
      const res = await salesAPI.sales(params)
      setSales(res.data?.results ?? [])
      setTotalCount(res.data?.count ?? 0)
    } catch { toast.error('Erreur chargement') }
    finally { setLoading(false) }
  }, [page, search, payFilter, statusFilter, dateFrom, dateTo, pageSize])

  useEffect(() => { load() }, [load])

  const handleCancel = async (sale) => {
    if (!confirm('Annuler cette vente ? Le stock sera restauré.')) return
    try {
      await salesAPI.cancelSale(sale.id)
      toast.success('Vente annulée — stock restauré')
      load()
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportsAPI.exportSales({ date_from: dateFrom, date_to: dateTo })
      downloadBlob(res.data, 'ventes.xlsx')
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur export') }
    finally { setExporting(false) }
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasFilters = search || payFilter || statusFilter !== '' || dateFrom || dateTo

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historique des ventes</h1>
          <p className="page-subtitle">{totalCount} vente(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={14} /></button>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <div className="spinner" /> : <Download size={14} />} Export Excel
            </button>
          )}
          <Link to="/pos" className="btn btn-primary"><Receipt size={15} /> Nouvelle vente</Link>
        </div>
      </div>

      <div className="search-bar">
        <div className="input-wrapper" style={{ flex:1, maxWidth:300 }}>
          <Search size={15} className="input-icon" />
          <input className="input has-icon" placeholder="N° facture, client…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input" style={{ width:160 }} value={payFilter}
          onChange={e => { setPayFilter(e.target.value); setPage(1) }}>
          <option value="">Tout paiement</option>
          {Object.entries(PAYMENT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ width:140 }} value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">Tous statuts</option>
          <option value="false">Validées</option>
          <option value="true">Annulées</option>
        </select>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Calendar size={14} style={{ color:'var(--text-muted)' }} />
          <input type="date" className="input" style={{ width:140 }}
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
          <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>→</span>
          <input type="date" className="input" style={{ width:140 }}
            value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setSearch(''); setPayFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1)
          }}><X size={13} /> Réinitialiser</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Par page :</span>
          <select
            className="input"
            style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem' }}
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner spinner-lg" /></div>
          ) : sales.length === 0 ? (
            <div className="empty-state"><Receipt size={36} /><h3>Aucune vente</h3><p>Modifiez les filtres</p></div>
          ) : (
            <table>
              <thead><tr>
                <th>Facture</th><th>Date</th><th>Client</th><th>Paiement</th>
                <th>Caissier</th><th style={{textAlign:'right'}}>Total</th>
                <th style={{textAlign:'center'}}>Statut</th><th></th>
              </tr></thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/sales/${s.id}`)} style={{ opacity: s.is_cancelled ? 0.55 : 1, cursor: 'pointer' }}>
                    <td><span className="td-mono" style={{ color:'var(--blue-600)', fontSize:'0.82rem' }}>{s.invoice_number}</span></td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{formatDatetime(s.created_at)}</td>
                    <td style={{ fontSize:'0.85rem' }}>{s.client_name || 'Comptoir'}</td>
                    <td><span className="badge badge-blue" style={{ fontSize:'0.68rem' }}>{PAYMENT_LABELS[s.payment_method] || s.payment_method}</span></td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{s.created_by_name || '—'}</td>
                    <td className="text-right">
                      <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.875rem', color: s.is_cancelled ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {formatCurrency(s.total_amount, currency)}
                      </span>
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {s.is_cancelled ? <span className="badge badge-grey">Annulée</span> : <span className="badge badge-ok">Validée</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <Link to={`/sales/${s.id}`} className="btn btn-ghost btn-icon btn-sm" data-tooltip="Détail"><Eye size={14} /></Link>
                        {!s.is_cancelled && isAdmin && (
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); handleCancel(s); }} data-tooltip="Annuler">
                            <XCircle size={14} style={{ color:'var(--danger)' }} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon btn-sm" data-tooltip="Facture PDF"
                          onClick={(e) => { e.stopPropagation(); reportsAPI.invoicePDF(s.id); }}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
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
    </div>
  )
}

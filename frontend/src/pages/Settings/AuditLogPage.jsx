import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, RefreshCw, X, Calendar, Shield,
  ShoppingBag, PackagePlus, SlidersHorizontal,
  Plus, Trash2, Edit2, ArrowLeftRight, AlertCircle
} from 'lucide-react'
import { settingsAPI, formatDatetime } from '../../api'
import useAuthStore from '../../store/authStore'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const ACTION_CONFIG = {
  sale:       { label: 'Vente',         color: '#2563eb', bg: '#eff6ff', Icon: ShoppingBag },
  restock:    { label: 'Réappro',       color: '#16a34a', bg: '#f0fdf4', Icon: PackagePlus },
  adjustment: { label: 'Ajustement',    color: '#d97706', bg: '#fffbeb', Icon: SlidersHorizontal },
  create:     { label: 'Création',      color: '#059669', bg: '#ecfdf5', Icon: Plus },
  update:     { label: 'Modification',  color: '#7c3aed', bg: '#f5f3ff', Icon: Edit2 },
  delete:     { label: 'Suppression',   color: '#dc2626', bg: '#fef2f2', Icon: Trash2 },
  conversion: { label: 'Conversion',    color: '#0891b2', bg: '#ecfeff', Icon: ArrowLeftRight },
  other:      { label: 'Autre',         color: '#6b7280', bg: '#f9fafb', Icon: AlertCircle },
}

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const isAdmin = useAuthStore(s => s.isAdmin())
  if (!isAdmin) return <Navigate to="/" replace />

  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await settingsAPI.auditLogs({
        page, page_size: PAGE_SIZE,
        ...(search       && { search }),
        ...(actionFilter && { action_type: actionFilter }),
        ...(dateFrom     && { date_from: dateFrom }),
        ...(dateTo       && { date_to: dateTo }),
      })
      setLogs(res.data?.results ?? [])
      setTotalCount(res.data?.count ?? 0)
    } catch { toast.error('Erreur chargement du journal') }
    finally { setLoading(false) }
  }, [page, search, actionFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = search || actionFilter || dateFrom || dateTo

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal d'audit</h1>
          <p className="page-subtitle">{totalCount} action(s) enregistrée(s)</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="search-bar">
        <div className="input-wrapper" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={15} className="input-icon" />
          <input
            className="input has-icon"
            placeholder="Rechercher dans les descriptions…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <select
          className="input" style={{ width: 170 }}
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
        >
          <option value="">Tous types</option>
          {Object.entries(ACTION_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <input type="date" className="input" style={{ width: 140 }}
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
          <input type="date" className="input" style={{ width: 140 }}
            value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setSearch(''); setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1)
          }}>
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <Shield size={40} />
              <h3>Aucune entrée dans le journal</h3>
              <p>Les actions seront enregistrées ici au fur et à mesure</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Utilisateur</th>
                  <th style={{ textAlign: 'center' }}>Type</th>
                  <th>Description</th>
                  <th>Adresse IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const cfg = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.other
                  const Icon = cfg.Icon
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDatetime(log.created_at)}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {log.user_name || <span style={{ color: 'var(--text-muted)' }}>Système</span>}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: '0.70rem', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 99,
                          background: cfg.bg,
                          color: cfg.color,
                        }}>
                          <Icon size={11} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.83rem', maxWidth: 480 }}>
                        {log.description}
                        {(log.old_value || log.new_value) && (
                          <LogDetail old={log.old_value} next={log.new_value} />
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}>
                          {log.ip_address || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination" style={{ padding: '12px 22px' }}>
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const pg = page <= 4 ? i + 1 : page - 3 + i
              if (pg < 1 || pg > totalPages) return null
              return (
                <button key={pg} className={`page-btn${page === pg ? ' active' : ''}`} onClick={() => setPage(pg)}>
                  {pg}
                </button>
              )
            })}
            <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
          </div>
        )}
      </div>
    </div>
  )
}

function LogDetail({ old: oldVal, next: newVal }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          marginLeft: 8, fontSize: '0.68rem', color: 'var(--blue-600)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {open ? '▲ masquer' : '▼ détails'}
      </button>
      {open && (
        <div style={{
          marginTop: 6, padding: '8px 12px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-main)', border: '1px solid var(--border)',
          fontSize: '0.72rem', fontFamily: 'var(--font-mono)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        }}>
          {oldVal && (
            <div>
              <span style={{ fontWeight: 700, color: 'var(--danger)', display: 'block', marginBottom: 2 }}>Avant</span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(oldVal, null, 2)}</pre>
            </div>
          )}
          {newVal && (
            <div>
              <span style={{ fontWeight: 700, color: 'var(--success)', display: 'block', marginBottom: 2 }}>Après</span>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(newVal, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </>
  )
}

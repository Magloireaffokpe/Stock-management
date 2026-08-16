import React, { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, DollarSign,
  Package, AlertTriangle, RefreshCw, ArrowRight, Eye, Zap
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Link } from 'react-router-dom'
import { reportsAPI, stockAPI, formatCurrency, formatDatetime } from '../../api'
import useAuthStore from '../../store/authStore'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

const COLORS_PIE = ['#1A52A0','#F06820','#16A34A','#7C3AED','#0891B2','#D97706','#DC2626']

function KPICard({ label, value, sub, variation, icon: Icon, color, bg, hideVariation = false }) {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isUp   = variation > 0
  const isDown = variation < 0
  const varClass = isUp ? 'up' : isDown ? 'down' : 'neutral'
  const VarIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <div className="kpi-card" style={{ '--kpi-color': color, '--kpi-bg': bg }}>
      <div className="kpi-card-icon">
        <Icon size={20} />
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {typeof value === 'number' && value > 999
          ? formatCurrency(value, currency)
          : value ?? '—'}
      </div>
      {!hideVariation && (
        <div className="kpi-sub">
          <span className={`kpi-variation ${varClass}`}>
            <VarIcon size={12} />
            {Math.abs(variation ?? 0).toFixed(1)}%
          </span>
          <span className="kpi-vs">vs période préc.</span>
        </div>
      )}
      {sub && <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0D1B33', border: 'none', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <p style={{ color: '#94AECF', fontSize: '0.72rem', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: '0.82rem', fontWeight: 700 }}>
          {p.name}: {typeof p.value === 'number' && p.value > 999
            ? formatCurrency(p.value, currency)
            : p.value}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isAdmin = useAuthStore(s => s.isAdmin())
  const [kpi, setKpi]       = useState(null)
  const [daily, setDaily]   = useState([])
  const [recent, setRecent] = useState([])
  const [catData, setCatData] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, dailyRes, recentRes, catRes, alertRes] = await Promise.all([
        reportsAPI.dashboard(),
        reportsAPI.dailyChart(7),
        reportsAPI.recentSales(),
        reportsAPI.categoryChart(),
        stockAPI.alerts(),
      ])
      setKpi(kpiRes.data)
      setDaily(dailyRes.data)
      setRecent(Array.isArray(recentRes.data) ? recentRes.data : recentRes.data?.results || [])
      setCatData(catRes.data?.slice(0, 5) || [])
      setAlerts((alertRes.data?.results ?? alertRes.data)?.slice(0, 5) || [])
    } catch (e) {
      toast.error('Erreur de chargement du tableau de bord')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const t = kpi?.today || {}
  const m = kpi?.month || {}
  const s = kpi?.stock || {}

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble en temps réel — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={load}>
            <RefreshCw size={14} /> Actualiser
          </button>
          <Link to="/pos" className="btn btn-orange">
            <Zap size={15} /> Nouvelle vente
          </Link>
        </div>
      </div>

      {/* Alertes critiques en haut */}
      {s.out_of_stock > 0 && (
        <div className="alert-banner danger" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{s.out_of_stock} produit(s) en rupture de stock</strong> —
            {s.critical > 0 && ` ${s.critical} en état critique —`} Action requise
          </span>
          <Link to="/catalog?stock_status=out_of_stock" style={{ marginLeft: 'auto', color: 'inherit', fontWeight: 700, fontSize: '0.8rem' }}>
            Voir <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* KPIs Aujourd'hui */}
      <div className="kpi-grid">
        <KPICard
          label="CA aujourd'hui"
          value={t.revenue || 0}
          variation={t.variation_revenue}
          sub={`${t.count || 0} vente(s)`}
          icon={DollarSign}
          color="var(--blue-500)"
          bg="var(--blue-100)"
          hideVariation={!isAdmin}
        />
        {isAdmin && (
          <KPICard
            label="CA ce mois"
            value={m.revenue || 0}
            variation={m.variation_revenue}
            sub={`${m.count || 0} vente(s)`}
            icon={TrendingUp}
            color="var(--success)"
            bg="var(--success-light)"
          />
        )}
        <KPICard
          label="Produits actifs"
          value={s.total_products || 0}
          variation={0}
          sub={`${s.low || 0} faible • ${s.critical || 0} critique • ${s.out_of_stock || 0} rupture`}
          icon={Package}
          color="var(--orange-500)"
          bg="var(--orange-100)"
        />
      </div>

      {/* Charts + Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>

        {/* Bar chart ventes 7 jours */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ventes — 7 derniers jours</span>
            <Link to="/reports" className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
              Voir tout <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => {
                    const [y, m, day] = d.split('-')
                    return `${day}/${m}`
                  }}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'var(--blue-50)' }} />
                <Bar
                  dataKey="revenue"
                  name={`CA (${currency})`}
                  fill="var(--blue-500)"
                  radius={[5, 5, 0, 0]}
                >
                  {daily.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.is_today ? 'var(--orange-500)' : 'var(--blue-500)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart catégories */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ventes par catégorie</span>
          </div>
          <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {catData.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 10px' }}>
                <Package size={28} />
                <p>Aucune vente enregistrée</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={catData}
                      dataKey="total_revenue"
                      nameKey="product__category__name"
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={72}
                      paddingAngle={3}
                    >
                      {catData.map((_, i) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCurrency(v, currency)}
                      contentStyle={{ background: '#0D1B33', border: 'none', borderRadius: 10, fontSize: '0.8rem', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  {catData.map((cat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS_PIE[i % COLORS_PIE.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {cat.product__category__name}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {formatCurrency(cat.total_revenue, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ventes récentes + Alertes stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* Ventes récentes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{isAdmin ? 'Dernières ventes' : 'Mes ventes — 7 derniers jours'}</span>
            <Link to="/sales" className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
              Historique <ArrowRight size={13} />
            </Link>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Aucune vente</td></tr>
                ) : recent.map(sale => (
                  <tr key={sale.id}>
                    <td><span className="td-mono" style={{ color: 'var(--blue-600)' }}>{sale.invoice_number}</span></td>
                    <td style={{ fontSize: '0.82rem' }}>{sale.client_name || 'Comptoir'}</td>
                    <td className="text-right">
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                        {formatCurrency(sale.total_amount, currency)}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatDatetime(sale.created_at)}
                    </td>
                    <td>
                      <Link to={`/sales/${sale.id}`} className="btn btn-ghost btn-icon btn-sm">
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertes stock */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertes stock</span>
            <Link to="/stock" className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
              Voir tout <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ padding: '8px' }}>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 10px' }}>
                <AlertTriangle size={28} />
                <p>Aucune alerte active</p>
              </div>
            ) : alerts.map(alert => {
              const levelCfg = {
                out:      { label: 'RUPTURE',  cls: 'badge-out' },
                critical: { label: 'CRITIQUE', cls: 'badge-critical' },
                low:      { label: 'FAIBLE',   cls: 'badge-low' },
              }
              const cfg = levelCfg[alert.alert_level] || levelCfg.low
              return (
                <div key={alert.id} style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 6,
                  background: alert.is_read ? 'var(--bg-main)' : 'var(--blue-50)',
                  border: `1px solid ${alert.is_read ? 'var(--border)' : 'var(--blue-200)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.product_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Stock restant : <strong>{alert.stock_at_alert}</strong> unité(s)
                    </div>
                  </div>
                  <span className={`badge ${cfg.cls}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

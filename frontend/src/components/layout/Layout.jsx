import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, RefreshCw,
  Boxes, Users, BarChart3, Settings, LogOut, Bell, AlertTriangle,
  ChevronRight, Store, Shield, Truck, BookOpen
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useAlertStore from '../../store/alertStore'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

const LOGO_URL = '/api/media/'

const NAV = [
  {
    section: 'Principal',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Dashboard',     exact: true },
      { to: '/pos',     icon: ShoppingCart,    label: 'Point de vente' },
    ],
  },
  {
    section: 'Gestion',
    items: [
      { to: '/catalog',  icon: Package,     label: 'Catalogue' },
      { to: '/suppliers',icon: Truck,       label: 'Fournisseurs', adminOnly: true },
      { to: '/sales',    icon: Receipt,     label: 'Ventes' },
      { to: '/restocks', icon: RefreshCw,   label: 'Réappros', adminOnly: true },
      { to: '/stock',    icon: Boxes,       label: 'Mouvements' },
      { to: '/clients',  icon: Users,       label: 'Clients' },
    ],
  },
  {
    section: 'Analyses',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Rapports', adminOnly: true },
    ],
  },
  {
    section: 'Système',
    items: [
      { to: '/settings', icon: Settings,  label: 'Paramètres',       adminOnly: true },
      { to: '/audit',    icon: Shield,    label: "Journal d'audit",  adminOnly: true },
      { to: '/lexique',  icon: BookOpen,  label: 'Lexique' },
    ],
  },
]

function PageTitle() {
  const { pathname } = useLocation()
  const titles = {
    '/':         'Tableau de bord',
    '/pos':      'Point de vente',
    '/catalog':  'Catalogue produits',
    '/sales':    'Historique ventes',
    '/restocks': 'Réapprovisionnements',
    '/stock':    'Mouvements de stock',
    '/clients':  'Clients',
    '/reports':  'Rapports & Analyses',
    '/settings': 'Paramètres',
    '/audit':    "Journal d'audit",
    '/profile':  'Mon Profil',
    '/lexique':  'Lexique',
  }
  const base = '/' + pathname.split('/')[1]
  return titles[base] || titles[pathname] || 'MICROLOGIS'
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const isAdmin = useAuthStore(s => s.isAdmin())
  const { unreadCount, markAllRead } = useAlertStore()
  const settings = useSettingsStore(s => s.settings)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showAlerts, setShowAlerts] = useState(false)
  const alerts = useAlertStore(s => s.alerts)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    toast.success('Déconnecté avec succès')
  }

  const initials = user
    ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '') || user.username[0].toUpperCase()
    : '?'

  return (
    <div className="layout">
      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          {settings?.logo_url ? (
            <div className="sidebar-logo-container">
              <img src={settings.logo_url} alt="Logo" />
            </div>
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'linear-gradient(135deg, #1A52A0, #F06820)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Store size={20} color="#fff" />
            </div>
          )}
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">
              {settings?.store_name || 'MICROLOGIS'}
            </span>
            <span className="sidebar-logo-sub">Stock Manager</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV.map(group => {
            const visibleItems = group.items.filter(item =>
              (!item.adminOnly && !item.adminOnly) || isAdmin
            )
            if (!visibleItems.length) return null
            return (
              <div key={group.section}>
                <p className="nav-section-label">{group.section}</p>
                {visibleItems.map(({ to, icon: Icon, label, exact, adminOnly }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {label === 'Mouvements' && unreadCount > 0 && (
                      <span className="nav-badge">{unreadCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* User — cliquable pour aller sur Mon Profil */}
        <div
          className="sidebar-user"
          onClick={() => navigate('/profile')}
          style={{ cursor: 'pointer' }}
          title="Mon Profil"
        >
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </div>
            <div className="user-role" style={{ fontSize: '0.68rem', color: 'rgba(148,174,207,0.7)' }}>
              {user?.role === 'admin' ? '⭐ Admin' : 'Employé'} · Mon profil
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={e => { e.stopPropagation(); handleLogout() }}
            data-tooltip="Déconnexion"
            style={{ color: 'var(--sidebar-text)' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ── CONTENT ─────────────────────────────────────── */}
      <div className="content-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-title"><PageTitle /></div>
          <div className="topbar-actions">
            {/* Alertes Bell */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => { setShowAlerts(!showAlerts); if (!showAlerts) useAlertStore.getState().fetchAlerts() }}
                data-tooltip="Alertes stock"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 9, height: 9,
                    background: 'var(--danger)', borderRadius: '50%',
                    border: '2px solid white',
                    animation: 'blink 1.5s infinite',
                  }} />
                )}
              </button>
              {showAlerts && (
                <AlertsDropdown
                  alerts={alerts}
                  onClose={() => setShowAlerts(false)}
                  onMarkAll={async () => { await markAllRead(); setShowAlerts(false) }}
                />
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`page-body ${pathname === '/pos' ? 'page-body-pos' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AlertsDropdown({ alerts, onClose, onMarkAll }) {
  const levelConfig = {
    out:      { label: 'Rupture',  color: '#991b1b', bg: '#fee2e2' },
    critical: { label: 'Critique', color: 'var(--danger)', bg: 'var(--danger-light)' },
    low:      { label: 'Faible',   color: 'var(--warning)', bg: 'var(--warning-light)' },
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        width: 340, background: 'white',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)', zIndex: 99,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>
            Alertes stock
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onMarkAll} style={{ fontSize: '0.75rem' }}>
            Tout marquer lu
          </button>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <AlertTriangle size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              Aucune alerte active
            </div>
          ) : alerts.map(alert => {
            const cfg = levelConfig[alert.alert_level] || levelConfig.low
            return (
              <div key={alert.id} style={{
                padding: '12px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: alert.is_read ? 'transparent' : 'var(--blue-50)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: cfg.color, marginTop: 6, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {alert.product_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: cfg.color, fontWeight: 600 }}>
                    {cfg.label} — {alert.stock_at_alert} unité(s) restante(s)
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import useSettingsStore from './store/settingsStore'
import useAlertStore from './store/alertStore'

import Layout from './components/layout/Layout'
import LoginPage from './pages/Auth/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import POSPage from './pages/POS/POSPage'
import CatalogPage from './pages/Catalog/CatalogPage'
import ProductDetailPage from './pages/Catalog/ProductDetailPage'
import StoresPage from './pages/Catalog/StoresPage'
import SuppliersPage from './pages/Catalog/SuppliersPage'
import SalesPage from './pages/Sales/SalesPage'
import SaleDetailPage from './pages/Sales/SaleDetailPage'
import RestocksPage from './pages/Sales/RestocksPage'
import StockPage from './pages/Stock/StockPage'
import ClientsPage from './pages/Clients/ClientsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import SettingsPage from './pages/Settings/SettingsPage'
import AuditLogPage from './pages/Settings/AuditLogPage'
import ProfilePage from './pages/Settings/ProfilePage'
import LexiquePage from './pages/Help/LexiquePage'

function RequireAuth({ children }) {
  const { accessToken, initialized } = useAuthStore()
  if (!initialized) return <div className="loading-screen"><div className="spinner spinner-lg" /></div>
  if (!accessToken) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const isAdmin = useAuthStore(s => s.isAdmin())
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { accessToken, fetchMe, initialized } = useAuthStore()
  const settings = useSettingsStore(s => s.settings)
  const fetchSettings = useSettingsStore(s => s.fetch)
  const { fetchCount, connectWS } = useAlertStore()

  useEffect(() => {
    if (accessToken) {
      fetchMe()
      fetchSettings()
      fetchCount()
      connectWS()
    } else {
      useAuthStore.setState({ initialized: true })
    }
  }, [accessToken])

  // Applique les couleurs de thème configurées dans la base aux variables CSS
  useEffect(() => {
    if (settings) {
      if (settings.color_primary) {
        document.documentElement.style.setProperty('--sidebar-bg', settings.color_primary)
      }
      if (settings.color_accent) {
        document.documentElement.style.setProperty('--blue-600', settings.color_accent)
        document.documentElement.style.setProperty('--sidebar-active', settings.color_accent)
      }
      if (settings.color_success) {
        document.documentElement.style.setProperty('--success', settings.color_success)
      }
    }
  }, [settings])

  // Logout on auth events
  useEffect(() => {
    const handler = () => useAuthStore.getState().logout()
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  if (!initialized) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Chargement…</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="catalog/:id" element={<ProductDetailPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="suppliers" element={<RequireAdmin><SuppliersPage /></RequireAdmin>} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sales/:id" element={<SaleDetailPage />} />
        <Route path="restocks" element={<RequireAdmin><RestocksPage /></RequireAdmin>} />
        <Route path="stock" element={<StockPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="reports" element={<RequireAdmin><ReportsPage /></RequireAdmin>} />
        <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
        <Route path="audit" element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="lexique" element={<LexiquePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

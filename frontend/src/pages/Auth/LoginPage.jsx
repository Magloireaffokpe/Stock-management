import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, Monitor, Smartphone } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, accessToken } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (accessToken) navigate('/', { replace: true })
  }, [accessToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('Veuillez remplir tous les champs')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(form.username, form.password)
      toast.success('Connexion réussie !')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />

      {/* Décoration arrière-plan */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%',
        width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(26,82,160,0.25) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '8%',
        width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(240,104,32,0.2) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div className="login-panel">
        <div className="login-card">

          {/* Logo */}
          <div className="login-logo-area">
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72,
              background: 'linear-gradient(135deg, #0D1B33 0%, #1A52A0 50%, #F06820 100%)',
              borderRadius: 18,
              marginBottom: 14,
              boxShadow: '0 8px 24px rgba(26,82,160,0.3)',
            }}>
              {/* Logo inline SVG inspiré du vrai logo */}
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                {/* Écran laptop */}
                <rect x="5" y="10" width="24" height="16" rx="2" fill="none" stroke="white" strokeWidth="2"/>
                {/* Cursor */}
                <path d="M13 18 L16 24 L17.5 20.5 L21 22 Z" fill="white" opacity="0.9"/>
                {/* Phone */}
                <rect x="26" y="14" width="13" height="18" rx="2" fill="none" stroke="white" strokeWidth="2"/>
                <rect x="28" y="16" width="9" height="12" rx="1" fill="white" opacity="0.2"/>
                {/* Lines dessous */}
                <line x1="5" y1="28" x2="24" y2="28" stroke="#F06820" strokeWidth="2.5"/>
                <line x1="7" y1="31" x2="22" y2="31" stroke="#1A52A0" strokeWidth="2"/>
                <line x1="10" y1="34" x2="20" y2="34" stroke="#1A52A0" strokeWidth="1.5" opacity="0.7"/>
              </svg>
            </div>

            {/* Nom avec typo du logo */}
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: '#1A52A0' }}>MICRO</span>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: '#1A2A3D' }}>LOGIS</span>
            </div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              — Informatique &amp; GSM —
            </div>
            <div className="login-subtitle">Gestionnaire de stock</div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="alert-banner danger" style={{ marginBottom: 18 }}>
                <Lock size={15} /> {error}
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Nom d'utilisateur</label>
              <div className="input-wrapper">
                <User size={15} className="input-icon" />
                <input
                  className="input has-icon"
                  type="text"
                  placeholder="Votre identifiant"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 22 }}>
              <label className="input-label">Mot de passe</label>
              <div className="input-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  className="input has-icon"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 11,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-xl w-full"
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Connexion…</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 28, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Monitor size={13} /> Application locale
              </span>
              <span>•</span>
              <span>v1.0 — Parakou, Bénin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

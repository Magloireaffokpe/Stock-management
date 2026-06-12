import React, { useState } from 'react'
import { User, Lock, Eye, EyeOff, Save, Shield } from 'lucide-react'
import { authAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore()
  const [tab, setTab] = useState('info')

  // ── Infos personnelles ──
  const [infoForm, setInfoForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
  })
  const [savingInfo, setSavingInfo] = useState(false)

  // ── Changement de mot de passe ──
  const [pwdForm, setPwdForm] = useState({
    current_password: '',
    new_password:     '',
    confirm_password: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [savingPwd, setSavingPwd]     = useState(false)

  const setInfo = (k, v) => setInfoForm(f => ({ ...f, [k]: v }))
  const setPwd  = (k, v) => setPwdForm(f  => ({ ...f, [k]: v }))

  // ── Enregistrer infos ──
  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      await authAPI.updateMe(infoForm)
      await fetchMe()
      toast.success('Informations mises à jour')
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur'
      toast.error(msg)
    } finally { setSavingInfo(false) }
  }

  // ── Changer le mot de passe ──
  const handleChangePwd = async () => {
    if (!pwdForm.current_password) { toast.error('Entrez votre mot de passe actuel'); return }
    if (pwdForm.new_password.length < 6) { toast.error('Le nouveau mot de passe doit faire au moins 6 caractères'); return }
    if (pwdForm.new_password !== pwdForm.confirm_password) { toast.error('Les mots de passe ne correspondent pas'); return }
    setSavingPwd(true)
    try {
      // PATCH /api/auth/me/ accepte {password} pour changer le mot de passe
      await authAPI.updateMe({ password: pwdForm.new_password })
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' })
      toast.success('Mot de passe changé avec succès ✓')
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur serveur'
      toast.error(msg)
    } finally { setSavingPwd(false) }
  }

  const initials = user
    ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '') || user.username?.[0]?.toUpperCase()
    : '?'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mon Profil</h1>
          <p className="page-subtitle">Gérez vos informations personnelles et votre mot de passe</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Carte identité */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px',
              background: user?.role === 'admin'
                ? 'linear-gradient(135deg, var(--orange-500), #f59e0b)'
                : 'linear-gradient(135deg, var(--blue-600), var(--blue-400))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', fontSize: '1.6rem',
            }}>
              {initials}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 4 }}>
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              @{user?.username}
            </div>
            <span className={`badge ${user?.role === 'admin' ? 'badge-orange' : 'badge-blue'}`}>
              {user?.role === 'admin' ? '⭐ Administrateur' : 'Employé'}
            </span>
          </div>

          {/* Tabs */}
          <div className="card" style={{ padding: 8, marginTop: 12 }}>
            {[
              { key: 'info', label: 'Informations', icon: User },
              { key: 'pwd',  label: 'Mot de passe', icon: Lock },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: tab === key ? 600 : 500,
                background: tab === key ? 'var(--blue-100)' : 'transparent',
                color: tab === key ? 'var(--blue-700)' : 'var(--text-secondary)',
                textAlign: 'left', marginBottom: 2, transition: 'all 0.15s',
              }}>
                <Icon size={15} style={{ opacity: tab === key ? 1 : 0.6 }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1 }}>

          {/* ── Informations personnelles ── */}
          {tab === 'info' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Informations personnelles</span>
              </div>
              <div className="card-body">
                <div className="grid-2" style={{ marginBottom: 16 }}>
                  <div className="input-group">
                    <label className="input-label">Prénom</label>
                    <input className="input" value={infoForm.first_name}
                      onChange={e => setInfo('first_name', e.target.value)}
                      placeholder="Votre prénom" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nom</label>
                    <input className="input" value={infoForm.last_name}
                      onChange={e => setInfo('last_name', e.target.value)}
                      placeholder="Votre nom" />
                  </div>
                  <div className="input-group" style={{ gridColumn: '1/-1' }}>
                    <label className="input-label">Adresse e-mail</label>
                    <input className="input" type="email" value={infoForm.email}
                      onChange={e => setInfo('email', e.target.value)}
                      placeholder="votre@email.com" />
                  </div>
                </div>

                <div className="alert-banner info" style={{ fontSize: '0.8rem', marginBottom: 20 }}>
                  <Shield size={14} />
                  Le nom d'utilisateur (<strong>@{user?.username}</strong>) ne peut pas être modifié ici.
                  Contactez l'administrateur si nécessaire.
                </div>

                <button className="btn btn-primary" onClick={handleSaveInfo} disabled={savingInfo}>
                  {savingInfo ? <><div className="spinner" /> Enregistrement…</> : <><Save size={15} /> Enregistrer</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Mot de passe ── */}
          {tab === 'pwd' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Changer mon mot de passe</span>
              </div>
              <div className="card-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.7 }}>
                  Choisissez un mot de passe robuste d'au moins <strong>6 caractères</strong>.<br />
                  Personne ne peut voir votre mot de passe, pas même l'administrateur.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>

                  {/* Nouveau mot de passe */}
                  <div className="input-group">
                    <label className="input-label">Nouveau mot de passe *</label>
                    <div className="input-wrapper" style={{ position: 'relative' }}>
                      <Lock size={15} className="input-icon" />
                      <input
                        className="input has-icon"
                        type={showNew ? 'text' : 'password'}
                        value={pwdForm.new_password}
                        onChange={e => setPwd('new_password', e.target.value)}
                        placeholder="Min. 6 caractères"
                        style={{ paddingRight: 40 }}
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} style={{
                        position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center',
                      }}>
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Indicateur de force */}
                    {pwdForm.new_password && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: pwdForm.new_password.length >= 12 ? '100%'
                              : pwdForm.new_password.length >= 8 ? '66%'
                              : pwdForm.new_password.length >= 6 ? '33%' : '10%',
                            background: pwdForm.new_password.length >= 12 ? 'var(--success)'
                              : pwdForm.new_password.length >= 8 ? 'var(--warning)'
                              : 'var(--danger)',
                            transition: 'all 0.3s',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {pwdForm.new_password.length >= 12 ? '✅ Robuste'
                            : pwdForm.new_password.length >= 8 ? '⚠️ Moyen'
                            : pwdForm.new_password.length >= 6 ? '🔸 Faible'
                            : '❌ Trop court'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirmer */}
                  <div className="input-group">
                    <label className="input-label">Confirmer le nouveau mot de passe *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="input has-icon"
                        type={showCurrent ? 'text' : 'password'}
                        value={pwdForm.confirm_password}
                        onChange={e => setPwd('confirm_password', e.target.value)}
                        placeholder="Répétez le mot de passe"
                        style={{ paddingRight: 40 }}
                      />
                      <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{
                        position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center',
                      }}>
                        {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {/* Validation en temps réel */}
                    {pwdForm.confirm_password && (
                      <p style={{ fontSize: '0.75rem', marginTop: 4,
                        color: pwdForm.new_password === pwdForm.confirm_password ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {pwdForm.new_password === pwdForm.confirm_password ? '✓ Les mots de passe correspondent' : '✗ Les mots de passe ne correspondent pas'}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleChangePwd}
                  disabled={savingPwd}
                  style={{ marginTop: 24 }}
                >
                  {savingPwd ? <><div className="spinner" /> Enregistrement…</> : <><Lock size={15} /> Changer le mot de passe</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

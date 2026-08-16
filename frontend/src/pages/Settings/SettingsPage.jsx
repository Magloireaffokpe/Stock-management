import React, { useState, useEffect } from 'react'
import {
  Save, Upload, Download, RefreshCw, Database, Users, Shield,
  Bell, Palette, FileText, X, Plus, Trash2, Eye, EyeOff, Lock, Pencil
} from 'lucide-react'
import { settingsAPI, authAPI, formatDate, downloadBlob } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const TABS = [
  { key:'store',   label:'Magasin',     icon:FileText  },
  { key:'theme',   label:'Apparence',   icon:Palette   },
  { key:'alerts',  label:'Alertes',     icon:Bell      },
  { key:'users',   label:'Utilisateurs',icon:Users     },
  { key:'backup',  label:'Sauvegarde',  icon:Database  },
]

export default function SettingsPage() {
  const { settings, update, invalidate } = useSettingsStore()
  const [tab, setTab]       = useState('store')
  const [form, setForm]     = useState({})
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) setForm({ ...settings })
  }, [settings])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      const fields = ['store_name','tagline','phone','whatsapp','email','address','city',
        'currency','currency_symbol','color_primary','color_accent','color_success',
        'low_stock_threshold','critical_stock_threshold','sound_enabled',
        'invoice_prefix','quotation_prefix','restock_prefix','tax_rate','footer_invoice_text']
      fields.forEach(k => { if (form[k] != null) fd.append(k, form[k]) })
      if (logoFile) fd.append('logo', logoFile)
      await update(fd)
      invalidate()
      toast.success('Paramètres enregistrés')
    } catch (e) {
      const err = e.response?.data
      const msg = typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  if (!form.store_name) return <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Configuration de l'application MICROLOGIS</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : <><Save size={15} /> Enregistrer</>}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:24 }}>
        {/* Sidebar tabs */}
        <div style={{ width:200, flexShrink:0 }}>
          <div className="card" style={{ padding:8 }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'9px 12px', borderRadius:'var(--radius-md)', border:'none', cursor:'pointer',
                fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight: tab===key ? 600 : 500,
                background: tab===key ? 'var(--blue-100)' : 'transparent',
                color: tab===key ? 'var(--blue-700)' : 'var(--text-secondary)',
                textAlign:'left', marginBottom:2, transition:'all 0.15s',
              }}>
                <Icon size={16} style={{ opacity: tab===key ? 1 : 0.6 }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1 }}>
          {/* ── MAGASIN ── */}
          {tab === 'store' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Informations du magasin</span></div>
              <div className="card-body">
                {/* Logo */}
                <div style={{ marginBottom:24 }}>
                  <label className="input-label" style={{ display:'block', marginBottom:10 }}>Logo du magasin</label>
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{
                      width:90, height:90, borderRadius:'var(--radius-lg)',
                      border:'2px solid var(--border)', overflow:'hidden',
                      background:'var(--bg-main)', display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {logoPreview || settings?.logo_url ? (
                        <img src={logoPreview || settings.logo_url} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                      ) : (
                        <span style={{ fontSize:'2rem' }}>🏪</span>
                      )}
                    </div>
                    <div>
                      <label className="btn btn-outline btn-sm" style={{ cursor:'pointer' }}>
                        <Upload size={13} /> Changer le logo
                        <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoChange} />
                      </label>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:6 }}>JPG, PNG, SVG — Max 2 Mo</p>
                    </div>
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom:14 }}>
                  <div className="input-group">
                    <label className="input-label">Nom du magasin *</label>
                    <input className="input" value={form.store_name || ''} onChange={e => set('store_name', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Slogan / Tagline</label>
                    <input className="input" value={form.tagline || ''} onChange={e => set('tagline', e.target.value)} placeholder="Votre partenaire High-Tech" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Téléphone</label>
                    <input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+229 97…" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">WhatsApp</label>
                    <input className="input" value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="+229 97…" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Email</label>
                    <input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Ville</label>
                    <input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="Parakou, Bénin" />
                  </div>
                  <div className="input-group" style={{ gridColumn:'1/-1' }}>
                    <label className="input-label">Adresse</label>
                    <textarea className="input" rows={2} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Adresse complète…" style={{ resize:'vertical' }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Devise</label>
                    <input className="input" value={form.currency || ''} onChange={e => set('currency', e.target.value)} placeholder="FCFA" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Symbole devise</label>
                    <input className="input" value={form.currency_symbol || ''} onChange={e => set('currency_symbol', e.target.value)} placeholder="F" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">TVA (%)</label>
                    <input className="input" type="number" min={0} max={100} step={0.5} value={form.tax_rate || 0} onChange={e => set('tax_rate', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Préfixe facture</label>
                    <input className="input" value={form.invoice_prefix || ''} onChange={e => set('invoice_prefix', e.target.value)} placeholder="MICRO" />
                  </div>
                  <div className="input-group" style={{ gridColumn:'1/-1' }}>
                    <label className="input-label">Pied de page facture</label>
                    <input className="input" value={form.footer_invoice_text || ''} onChange={e => set('footer_invoice_text', e.target.value)} placeholder="Merci pour votre confiance !" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── THÈME ── */}
          {tab === 'theme' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Couleurs et apparence</span></div>
              <div className="card-body">
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:20 }}>
                  Personnalisez les couleurs de l'interface. Le bleu doit rester la couleur dominante.
                </p>
                <div className="grid-3" style={{ marginBottom:20 }}>
                  {[
                    { key:'color_primary', label:'Couleur principale (Sidebar)', desc:'Fond de la barre latérale' },
                    { key:'color_accent',  label:'Couleur d\'accent (Boutons)',   desc:'Boutons principaux, liens actifs' },
                    { key:'color_success', label:'Couleur succès',                desc:'Badges OK, confirmations' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="input-group">
                      <label className="input-label">{label}</label>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <input
                          type="color"
                          value={form[key] || '#1A52A0'}
                          onChange={e => set(key, e.target.value)}
                          style={{ width:46, height:36, borderRadius:'var(--radius-sm)', border:'1.5px solid var(--border)', cursor:'pointer', padding:2 }}
                        />
                        <input
                          className="input"
                          value={form[key] || ''}
                          onChange={e => set(key, e.target.value)}
                          placeholder="#1A52A0"
                          style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}
                        />
                      </div>
                      <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:3 }}>{desc}</p>
                    </div>
                  ))}
                </div>

                {/* Prévisualisation */}
                <div style={{ padding:'16px 20px', background:form.color_primary||'#1A2B4A', borderRadius:'var(--radius-lg)', marginBottom:16 }}>
                  <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.72rem', marginBottom:10, letterSpacing:1, textTransform:'uppercase' }}>Prévisualisation sidebar</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {['Dashboard','Point de vente','Catalogue','Rapports'].map((item, i) => (
                      <div key={item} style={{
                        padding:'8px 12px', borderRadius:'var(--radius-md)',
                        background: i===0 ? form.color_accent||'#1A52A0' : 'transparent',
                        color: i===0 ? '#fff' : 'rgba(148,174,207,0.8)',
                        fontSize:'0.82rem', fontWeight: i===0 ? 600 : 400,
                        display:'flex', alignItems:'center', gap:8,
                      }}>
                        <div style={{ width:14, height:14, borderRadius:'50%', background:'currentColor', opacity:0.4 }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="alert-banner info" style={{ fontSize:'0.8rem' }}>
                  <Shield size={14} />
                  Gardez des couleurs suffisamment contrastées pour l'accessibilité et la lisibilité.
                </div>
              </div>
            </div>
          )}

          {/* ── ALERTES ── */}
          {tab === 'alerts' && (
            <div className="card">
              <div className="card-header"><span className="card-title">Seuils d'alerte stock</span></div>
              <div className="card-body">
                <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:20 }}>
                  Ces seuils déclenchent automatiquement les alertes et notifications en temps réel.
                  Chaque produit peut avoir son propre seuil qui prend priorité sur ces valeurs globales.
                </p>
                <div className="grid-2" style={{ marginBottom:20 }}>
                  <div>
                    <div className="input-group" style={{ marginBottom:8 }}>
                      <label className="input-label">
                        <span style={{ color:'var(--warning)', fontWeight:700 }}>●</span> Seuil stock faible
                      </label>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <input className="input" type="number" min={1} value={form.low_stock_threshold || 5} onChange={e => set('low_stock_threshold', parseInt(e.target.value))} style={{ maxWidth:120 }} />
                        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>unités</span>
                      </div>
                    </div>
                    <p style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Alerte jaune quand le stock ≤ ce seuil</p>
                  </div>
                  <div>
                    <div className="input-group" style={{ marginBottom:8 }}>
                      <label className="input-label">
                        <span style={{ color:'var(--danger)', fontWeight:700 }}>●</span> Seuil stock critique
                      </label>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <input className="input" type="number" min={0} value={form.critical_stock_threshold || 2} onChange={e => set('critical_stock_threshold', parseInt(e.target.value))} style={{ maxWidth:120 }} />
                        <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>unités</span>
                      </div>
                    </div>
                    <p style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Alerte rouge + son quand le stock ≤ ce seuil</p>
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom:20 }}>
                  <label className="input-label">Son d'alerte</label>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.sound_enabled !== false}
                        onChange={e => set('sound_enabled', e.target.checked)}
                        style={{ width:16, height:16, accentColor:'var(--blue-600)' }}
                      />
                      <span style={{ fontSize:'0.875rem', fontWeight:500 }}>
                        Activer le son pour les alertes critiques
                      </span>
                    </label>
                  </div>
                </div>

                {/* Simulation visuelle */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                  <p style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:10 }}>Simulation des indicateurs</p>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    {[
                      { label:`Stock OK (> ${form.low_stock_threshold || 5})`, cls:'ok', qty: (form.low_stock_threshold||5)+1 },
                      { label:`Faible (≤ ${form.low_stock_threshold || 5})`,   cls:'low', qty: form.low_stock_threshold||5 },
                      { label:`Critique (≤ ${form.critical_stock_threshold||2})`, cls:'critical', qty: form.critical_stock_threshold||2 },
                      { label:'Rupture (= 0)', cls:'out', qty: 0 },
                    ].map(s => (
                      <div key={s.cls} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', background:'var(--bg-main)', borderRadius:'var(--radius-md)' }}>
                        <span className={`stock-dot ${s.cls}`}>{s.qty}</span>
                        <span style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── UTILISATEURS ── */}
          {tab === 'users' && <UsersTab />}

          {/* ── SAUVEGARDE ── */}
          {tab === 'backup' && <BackupTab />}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ONGLET UTILISATEURS
══════════════════════════════════════════════════ */
function UsersTab() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await authAPI.users()
      setUsers(res.data?.results ?? res.data ?? [])
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (user) => {
    if (user.id === currentUser?.id) { toast.error('Impossible de désactiver votre propre compte'); return }
    try {
      await authAPI.updateUser(user.id, { is_active: !user.is_active })
      toast.success(user.is_active ? 'Compte désactivé' : 'Compte réactivé')
      load()
    } catch { toast.error('Erreur') }
  }

  const deleteUser = async (user) => {
    if (user.id === currentUser?.id) { toast.error('Impossible de supprimer votre propre compte'); return }
    if (!confirm(`Supprimer définitivement ${user.username} ?`)) return
    try {
      await authAPI.deleteUser(user.id)
      toast.success('Utilisateur supprimé')
      load()
    } catch { toast.error('Erreur') }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Gestion des utilisateurs</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditUser(null); setShowModal(true) }}>
          <Plus size={14} /> Nouvel utilisateur
        </button>
      </div>
      <div className="table-wrapper">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <table>
            <thead><tr>
              <th>Utilisateur</th><th>Nom complet</th><th>Rôle</th>
              <th style={{textAlign:'center'}}>Statut</th>
              <th>Dernière connexion</th><th></th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{
                        width:32, height:32, borderRadius:'50%',
                        background:`linear-gradient(135deg, ${u.role==='admin'?'var(--orange-500), var(--orange-400)':'var(--blue-500), var(--blue-400)'})`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'var(--font-display)', fontWeight:800, color:'#fff', fontSize:'0.8rem', flexShrink:0,
                      }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.82rem', fontWeight:700 }}>{u.username}</span>
                      {u.id === currentUser?.id && <span style={{ fontSize:'0.65rem', color:'var(--blue-600)', fontWeight:700 }}>(vous)</span>}
                    </div>
                  </td>
                  <td style={{ fontSize:'0.875rem' }}>{u.first_name} {u.last_name}</td>
                  <td>
                    <span className={`badge ${u.role==='admin'?'badge-orange':'badge-blue'}`}>
                      {u.role==='admin'?'⭐ Admin':'Employé'}
                    </span>
                  </td>
                  <td style={{ textAlign:'center' }}>
                    {u.is_active
                      ? <span className="badge badge-ok">Actif</span>
                      : <span className="badge badge-grey">Inactif</span>}
                  </td>
                  <td style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                    {u.last_login ? formatDate(u.last_login) : 'Jamais connecté'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditUser(u); setShowModal(true) }} data-tooltip="Modifier"><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleActive(u)} data-tooltip={u.is_active?'Désactiver':'Réactiver'}>
                        <Shield size={14} style={{ color: u.is_active ? 'var(--success)' : 'var(--text-muted)' }} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteUser(u)}>
                          <Trash2 size={14} style={{ color:'var(--danger)' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username:   user?.username   || '',
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    phone:      user?.phone      || '',
    role:       user?.role       || 'employee',
    password:   '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSave = async () => {
    if (!form.username) { toast.error('Nom d\'utilisateur requis'); return }
    if (!isEdit && !form.password) { toast.error('Mot de passe requis'); return }
    setSaving(true)
    try {
      const data = { ...form }
      if (!data.password) delete data.password
      if (isEdit) {
        await authAPI.updateUser(user.id, data)
        toast.success('Utilisateur mis à jour')
      } else {
        await authAPI.createUser(data)
        toast.success('Utilisateur créé')
      }
      onSaved()
    } catch (e) {
      const err = e.response?.data
      toast.error(typeof err === 'object' ? Object.values(err).flat().join(' | ') : 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{isEdit ? `Modifier — ${user.username}` : 'Nouvel utilisateur'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ marginBottom:12 }}>
            <div className="input-group">
              <label className="input-label">Nom d'utilisateur *</label>
              <input className="input" value={form.username} onChange={e => set('username', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Rôle</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="employee">Employé</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Prénom</label>
              <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Nom</label>
              <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Téléphone</label>
              <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+229 00 00 00 00" />
            </div>
            <div className="input-group" style={{ gridColumn:'1/-1' }}>
              <label className="input-label">{isEdit ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
              <div className="input-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  className="input has-icon"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder={isEdit ? '••••••••' : 'Min. 6 caractères'}
                  style={{ paddingRight:40 }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                  position:'absolute', right:11, background:'none', border:'none',
                  cursor:'pointer', color:'var(--text-muted)', padding:0,
                  display:'flex', alignItems:'center',
                }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" /> Enregistrement…</> : (isEdit ? 'Mettre à jour' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ONGLET SAUVEGARDE
══════════════════════════════════════════════════ */
function BackupTab() {
  const [backups, setBackups]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)

  useEffect(() => { loadBackups() }, [])

  const loadBackups = async () => {
    setLoading(true)
    try {
      const res = await settingsAPI.backupList()
      setBackups(res.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await settingsAPI.exportDB()
      downloadBlob(res.data, `micrologis_backup_${new Date().toISOString().slice(0,10)}.sqlite3`)
      toast.success('Base de données téléchargée')
    } catch { toast.error('Erreur') }
    finally { setExporting(false) }
  }

  const handleManualBackup = async () => {
    try {
      const res = await settingsAPI.manualBackup()
      toast.success(res.data.message)
      loadBackups()
    } catch { toast.error('Erreur') }
  }

  const handleRestore = async () => {
    if (!restoreFile) { toast.error('Sélectionnez un fichier .sqlite3'); return }
    if (!confirm('⚠️ La restauration remplacera TOUTES les données actuelles.\nCette action est irréversible. Continuer ?')) return
    setRestoring(true)
    try {
      await settingsAPI.restoreDB(restoreFile)
      toast.success('Restauration réussie ! Relancez le serveur pour appliquer.')
      setRestoreFile(null)
    } catch { toast.error('Erreur de restauration') }
    finally { setRestoring(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Export / Actions */}
      <div className="card">
        <div className="card-header"><span className="card-title">Sauvegarde de la base de données</span></div>
        <div className="card-body">
          <p style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:20, lineHeight:1.7 }}>
            Toute la base de données MICROLOGIS est dans un seul fichier <code style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', background:'var(--bg-main)', padding:'2px 6px', borderRadius:4 }}>db.sqlite3</code>.
            Téléchargez-le régulièrement sur une clé USB ou dans le cloud.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? <><div className="spinner" /> Téléchargement…</> : <><Download size={15} /> Télécharger la BDD</>}
            </button>
            <button className="btn btn-outline" onClick={handleManualBackup}>
              <Database size={15} /> Sauvegarder maintenant
            </button>
          </div>
        </div>
      </div>

      {/* Restauration */}
      <div className="card">
        <div className="card-header"><span className="card-title">Restaurer une sauvegarde</span></div>
        <div className="card-body">
          <div className="alert-banner danger" style={{ marginBottom:16 }}>
            <Shield size={15} />
            <strong>Attention :</strong> La restauration remplace toutes les données actuelles. Faites d'abord une sauvegarde.
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <label className="btn btn-outline" style={{ cursor:'pointer' }}>
              <Upload size={14} />
              {restoreFile ? restoreFile.name : 'Sélectionner un fichier .sqlite3'}
              <input type="file" accept=".sqlite3" style={{ display:'none' }}
                onChange={e => setRestoreFile(e.target.files?.[0] || null)} />
            </label>
            {restoreFile && (
              <button className="btn btn-danger" onClick={handleRestore} disabled={restoring}>
                {restoring ? <><div className="spinner" /> Restauration…</> : 'Restaurer'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste sauvegardes */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sauvegardes automatiques</span>
          <button className="btn btn-ghost btn-sm" onClick={loadBackups}><RefreshCw size={13} /></button>
        </div>
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:30 }}><div className="spinner" /></div>
          ) : backups.length === 0 ? (
            <div className="empty-state" style={{ padding:'24px' }}>
              <Database size={28} /><h3>Aucune sauvegarde</h3>
              <p>Cliquez sur « Sauvegarder maintenant »</p>
            </div>
          ) : (
            <table>
              <thead><tr><th>Fichier</th><th>Taille</th><th>Date</th></tr></thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={i}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem' }}>{b.filename}</span></td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{b.size_kb} Ko</td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

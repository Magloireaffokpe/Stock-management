import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Package, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { catalogAPI, stockAPI, formatCurrency, formatDatetime } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import toast from 'react-hot-toast'

const STOCK_STATUS = {
  ok:           { label: 'En stock',  cls: 'badge-ok' },
  low:          { label: 'Faible',    cls: 'badge-low' },
  critical:     { label: 'Critique',  cls: 'badge-critical' },
  out_of_stock: { label: 'Rupture',   cls: 'badge-out' },
}

const MOVEMENT_ICONS = {
  initial:    { icon: Package,      color: 'var(--blue-500)',  label: 'Stock initial' },
  restock:    { icon: TrendingUp,   color: 'var(--success)',   label: 'Réapprovisionnement' },
  sale:       { icon: TrendingDown, color: 'var(--orange-500)',label: 'Vente' },
  loss:       { icon: TrendingDown, color: 'var(--danger)',    label: 'Perte/Casse' },
  correction: { icon: RefreshCw,    color: 'var(--blue-500)',  label: 'Correction' },
  return:     { icon: TrendingUp,   color: 'var(--success)',   label: 'Retour client' },
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      catalogAPI.product(id),
      stockAPI.productMovements(id)
    ])
    .then(([pRes, mRes]) => {
      setProduct(pRes.data)
      setMovements(mRes.data?.results ?? mRes.data ?? [])
    })
    .catch(() => toast.error('Produit introuvable'))
    .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>
  if (!product) return <div className="empty-state"><h3>Produit introuvable</h3><Link to="/catalog">← Retour</Link></div>

  const ss = STOCK_STATUS[product.stock_status] || STOCK_STATUS.ok

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Link to="/catalog" className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {product.name}
              {!product.is_active && <span className="badge badge-grey">Inactif</span>}
            </h1>
            <p className="page-subtitle">SKU: {product.sku} — {product.category_name}</p>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:20 }}>
        {/* Résumé Produit */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            {product.image_url && (
              <div style={{ 
                width: '100%', height: 200, 
                backgroundImage: `url(${product.image_url})`, 
                backgroundSize: 'cover', backgroundPosition: 'center',
                borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)'
              }} />
            )}
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Stock actuel</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${ss.cls}`}>{ss.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem' }}>
                    {product.stock_quantity}
                  </span>
                </div>
              </div>
              <div className="divider" style={{ margin: '10px 0' }} />
              
              <div className="divider" style={{ margin: '10px 0' }} />

              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.875rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Prix de vente</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color: 'var(--blue-600)' }}>{formatCurrency(product.selling_price, currency)}</span>
              </div>

              <div className="divider" style={{ margin: '10px 0' }} />

              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Boutique</span>
                <span style={{ fontWeight: 600 }}>{product.store_name || '—'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Seuil d'alerte</span>
                <span style={{ fontFamily:'var(--font-mono)' }}>{product.low_stock_threshold || 'Global'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Fournisseur</span>
                <span style={{ fontWeight: 600 }}>{product.supplier_name || '—'}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>État</span>
                <span style={{ textTransform: 'capitalize' }}>{product.condition}</span>
              </div>

              {product.description && (
                <>
                  <div className="divider" style={{ margin: '10px 0' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>Description :</strong>
                    <p style={{ marginTop: 4, lineHeight: 1.5 }}>{product.description}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Historique des mouvements */}
        <div>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} style={{ color: 'var(--blue-500)' }} />
              <span className="card-title">Historique des mouvements</span>
            </div>
            <div className="table-wrapper">
              {movements.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Aucun mouvement enregistré.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'center' }}>Quantité</th>
                      <th style={{ textAlign: 'center' }}>Avant → Après</th>
                      <th>Référence</th>
                      <th>Opérateur</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => {
                      const cfg = MOVEMENT_ICONS[m.movement_type] || MOVEMENT_ICONS.correction
                      const Icon = cfg.icon
                      const sign = ['sale', 'loss'].includes(m.movement_type) ? '-' : '+'
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {formatDatetime(m.created_at)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon size={14} style={{ color: cfg.color }} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: cfg.color }}>
                                {cfg.label}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              fontFamily: 'var(--font-mono)', fontWeight: 700, 
                              color: sign === '-' ? 'var(--danger)' : 'var(--success)' 
                            }}>
                              {m.movement_type === 'initial' ? m.quantity : `${sign}${m.quantity}`}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{m.stock_before}</span>
                            <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: 600 }}>{m.stock_after}</span>
                          </td>
                          <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                            {m.reference ? (
                              m.movement_type === 'sale' || m.movement_type === 'sale_cancel' ? (
                                <Link to={`/sales/${m.reference_id || ''}`}
                                  style={{ color:'var(--blue-600)', textDecoration:'none' }}
                                  onClick={e => !m.reference_id && e.preventDefault()}
                                >
                                  {m.reference}
                                </Link>
                              ) : m.movement_type === 'restock' ? (
                                <span style={{ color:'var(--success)' }}>{m.reference}</span>
                              ) : (
                                <span>{m.reference}</span>
                              )
                            ) : '—'}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>{m.created_by_name}</td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.note || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

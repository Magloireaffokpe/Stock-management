import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, XCircle, Package } from 'lucide-react'
import { salesAPI, reportsAPI, formatCurrency, formatDatetime } from '../../api'
import useSettingsStore from '../../store/settingsStore'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const PAYMENT_LABELS = { cash:'Espèces', mtn:'MTN MoMo', moov:'Moov Money', celtiis:'Celtiis Money', card:'Carte', transfer:'Virement', mixed:'Mixte' }

export default function SaleDetailPage() {
  const { id } = useParams()
  const currency = useSettingsStore(s => s.settings?.currency || 'FCFA')
  const isAdmin  = useAuthStore(s => s.isAdmin())
  const [sale, setSale]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    salesAPI.sale(id)
      .then(r => setSale(r.data))
      .catch(() => toast.error('Vente introuvable'))
      .finally(() => setLoading(false))
  }, [id])

  const handleCancel = async () => {
    if (!confirm('Annuler cette vente ? Le stock sera restauré automatiquement.')) return
    try {
      const res = await salesAPI.cancelSale(id)
      setSale(res.data)
      toast.success('Vente annulée')
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="spinner spinner-lg" /></div>
  if (!sale)   return <div className="empty-state"><h3>Vente introuvable</h3><Link to="/sales">← Retour</Link></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Link to="/sales" className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="page-title" style={{ fontFamily:'var(--font-mono)', color:'var(--blue-600)' }}>
              {sale.invoice_number}
            </h1>
            <p className="page-subtitle">{formatDatetime(sale.created_at)}</p>
          </div>
          {sale.is_cancelled && <span className="badge badge-grey" style={{ fontSize:'0.85rem', padding:'6px 14px' }}>ANNULÉE</span>}
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-outline"
            onClick={() => reportsAPI.invoicePDF(sale.id)}
          >
            <Download size={15} /> Facture PDF
          </button>
          {!sale.is_cancelled && isAdmin && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel}>
              <XCircle size={15} /> Annuler la vente
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* Produits */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Articles vendus</span></div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th style={{textAlign:'center'}}>Qté</th>
                  <th style={{textAlign:'right'}}>Prix unit.</th>
                  <th style={{textAlign:'right'}}>Sous-total</th>
                  <th style={{textAlign:'right'}}>Marge</th>
                </tr></thead>
                <tbody>
                  {sale.items?.map(item => {
                    const margin = (parseFloat(item.unit_price) - parseFloat(item.purchase_price)) * item.quantity
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{item.product_name}</div>
                        </td>
                        <td>
                          <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{item.supplier_name || '—'}</div>
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{item.quantity}</span>
                        </td>
                        <td className="text-right">
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem' }}>
                            {formatCurrency(item.unit_price, currency)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>
                            {formatCurrency(item.subtotal, currency)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.82rem', color:'var(--success)', fontWeight:600 }}>
                            +{formatCurrency(margin, currency)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Résumé */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Client */}
          <div className="card">
            <div className="card-header"><span className="card-title">Client</span></div>
            <div className="card-body">
              <p style={{ fontWeight:600, marginBottom:4 }}>{sale.client_name || 'Client comptoir'}</p>
              <p style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>Caissier : {sale.created_by_name}</p>
            </div>
          </div>

          {/* Totaux */}
          <div className="card">
            <div className="card-header"><span className="card-title">Récapitulatif</span></div>
            <div className="card-body">
              {[
                { label:'Sous-total', value: formatCurrency(sale.subtotal, currency) },
                ...(parseFloat(sale.discount)>0 ? [{ label:'Remise', value:`- ${formatCurrency(sale.discount, currency)}`, color:'var(--danger)' }] : []),
                ...(parseFloat(sale.tax_amount)>0 ? [{ label:'TVA', value: formatCurrency(sale.tax_amount, currency) }] : []),
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'0.875rem' }}>
                  <span style={{ color:'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color: r.color || 'var(--text-primary)' }}>{r.value}</span>
                </div>
              ))}
              <div className="divider" style={{ margin:'10px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>TOTAL</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'1.25rem', color:'var(--text-primary)' }}>
                  {formatCurrency(sale.total_amount, currency)}
                </span>
              </div>
              <div className="divider" style={{ margin:'10px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Paiement</span>
                <span className="badge badge-blue">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-secondary)' }}>Montant reçu</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{formatCurrency(sale.amount_paid, currency)}</span>
              </div>
              {parseFloat(sale.change_given) > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem' }}>
                  <span style={{ color:'var(--success)', fontWeight:600 }}>Monnaie rendue</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success)' }}>{formatCurrency(sale.change_given, currency)}</span>
                </div>
              )}
              {sale.total_margin !== undefined && (
                <>
                  <div className="divider" style={{ margin:'10px 0' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem' }}>
                    <span style={{ color:'var(--text-secondary)' }}>Bénéfice net</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success)' }}>+{formatCurrency(sale.total_margin, currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Annulation info */}
          {sale.is_cancelled && (
            <div className="alert-banner danger">
              <XCircle size={15} />
              <div>
                <strong>Vente annulée</strong>
                {sale.cancelled_at && <div style={{ fontSize:'0.78rem', marginTop:2 }}>Le {formatDatetime(sale.cancelled_at)} par {sale.cancelled_by_name}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

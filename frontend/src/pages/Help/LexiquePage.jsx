import React, { useState } from 'react'
import { Search, BookOpen, Tag, CreditCard, Package, TrendingUp, TrendingDown, RefreshCw, Boxes, FileText, HelpCircle } from 'lucide-react'

const SECTIONS = [
  {
    id: 'prefixes',
    icon: FileText,
    title: 'Préfixes & Numérotation',
    color: 'var(--blue-500)',
    items: [
      {
        term: 'MICRO-AAAA-XXXX',
        label: 'Numéro de facture',
        description: 'Format des factures de vente. « MICRO » est le préfixe configurable, « AAAA » est l\'année, « XXXX » le numéro séquentiel sur 4 chiffres. Exemple : MICRO-2026-0042.',
      },
      {
        term: 'DEV-AAAA-XXXX',
        label: 'Numéro de devis',
        description: 'Format des devis clients. « DEV » est le préfixe par défaut (configurable dans Paramètres). Un devis peut être converti en vente, générant alors une facture.',
      },
      {
        term: 'REAP-AAAA-XXXX',
        label: 'Référence de réapprovisionnement',
        description: 'Format des bons de réapprovisionnement. « REAP » est le préfixe par défaut. Ces références sont utilisées pour tracer l\'entrée de marchandises en stock.',
      },
      {
        term: 'Préfixe',
        label: 'Code configurable',
        description: 'Vous pouvez personnaliser les préfixes (MICRO, DEV, REAP) depuis la page Paramètres pour correspondre à votre identité commerciale. Ex: « ML » pour Micrologis.',
      },
    ],
  },
  {
    id: 'stock-status',
    icon: Boxes,
    title: 'États du stock',
    color: 'var(--success)',
    items: [
      {
        term: 'En stock (ok)',
        label: 'Stock normal',
        description: 'La quantité disponible est supérieure au seuil d\'alerte faible défini dans les Paramètres ou sur le produit lui-même.',
        badge: { text: 'En stock', cls: 'badge-ok' },
      },
      {
        term: 'Faible (low)',
        label: 'Stock faible',
        description: 'La quantité descend sous le seuil d\'alerte de niveau 1 (par défaut 5 unités). Une notification est générée automatiquement.',
        badge: { text: 'Faible', cls: 'badge-low' },
      },
      {
        term: 'Critique (critical)',
        label: 'Stock critique',
        description: 'La quantité descend sous le seuil critique de niveau 2 (par défaut 2 unités). Alerte prioritaire, réapprovisionnement urgent recommandé.',
        badge: { text: 'Critique', cls: 'badge-critical' },
      },
      {
        term: 'Rupture (out_of_stock)',
        label: 'Rupture de stock',
        description: 'La quantité est nulle ou négative. Ce produit n\'apparaît pas dans le Point de Vente et ne peut pas être vendu.',
        badge: { text: 'Rupture', cls: 'badge-out' },
      },
    ],
  },
  {
    id: 'movements',
    icon: TrendingUp,
    title: 'Types de mouvements de stock',
    color: 'var(--orange-500)',
    items: [
      {
        term: 'initial',
        label: 'Stock initial',
        description: 'Mouvement enregistré lors de la création du produit avec un stock de départ. C\'est le premier mouvement d\'un article.',
        icon: Package,
      },
      {
        term: 'restock',
        label: 'Réapprovisionnement',
        description: 'Entrée en stock validée par un administrateur. Le stock augmente. Lié à un bon de réapprovisionnement (REAP-).',
        icon: TrendingUp,
      },
      {
        term: 'sale',
        label: 'Vente',
        description: 'Sortie de stock suite à une vente validée sur le Point de Vente (POS). Le stock diminue automatiquement.',
        icon: TrendingDown,
      },
      {
        term: 'adjustment',
        label: 'Ajustement manuel',
        description: 'Ajustement de stock effectué par un administrateur depuis la page « Mouvements de stock » (bouton « Ajustement manuel »). Utilisé pour corriger les inventaires, les écarts ou la casse. La quantité saisie est ajoutée (positive) ou retirée (négative).',
        icon: Package,
      },
      {
        term: 'correction',
        label: 'Correction produit',
        description: 'Créé automatiquement lorsque la quantité est modifiée directement dans la fiche produit. Chaque écart entre l\'ancien et le nouveau stock est tracé.',
        icon: Package,
      },
      {
        term: 'return',
        label: 'Retour client',
        description: 'Retour d\'un article par un client. Le stock est réintégré. Ce mouvement doit être validé par un administrateur (via « Ajustement manuel », type Retour client).',
        icon: RefreshCw,
      },
      {
        term: 'loss',
        label: 'Perte / Casse',
        description: 'Sortie de stock non commerciale : vol, casse, produit périmé ou endommagé. Diminue le stock et génère un mouvement tracé.',
        icon: TrendingDown,
      },
      {
        term: 'sale_cancel',
        label: 'Annulation de vente',
        description: 'Créé automatiquement lorsqu\'une vente est annulée : les quantités vendues sont restituées au stock. La référence est le numéro de facture.',
        icon: RefreshCw,
      },
      {
        term: 'restock_cancel',
        label: 'Annulation de réappro',
        description: 'Créé lorsqu\'un réapprovisionnement est modifié à la baisse ou supprimé : les quantités concernées sont retirées du stock.',
        icon: TrendingDown,
      },
    ],
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Moyens de paiement',
    color: 'var(--blue-600)',
    items: [
      { term: 'cash', label: 'Espèces', description: 'Paiement en espèces (billets et pièces). C\'est le seul moyen de paiement proposé au Point de Vente : chaque vente est enregistrée comme un paiement « Espèces » et le système calcule automatiquement la monnaie à rendre (montant payé − total).' },
    ],
  },
  {
    id: 'product',
    icon: Tag,
    title: 'Termes produit',
    color: 'var(--blue-400)',
    items: [
      { term: 'SKU', label: 'Stock Keeping Unit', description: 'Code unique d\'identification interne d\'un produit. Généré automatiquement si non fourni, au format « PREFIXE-CATEGORIE-SUFFIXE » : les 3 premières lettres de la catégorie, son identifiant, puis 6 caractères aléatoires. Ex. « ELE-3-1A2B3C ».' },
      { term: 'Seuil d\'alerte', label: 'Seuil de réapprovisionnement', description: 'Quantité minimale en dessous de laquelle une alerte de stock faible est déclenchée. Configurable globalement (Paramètres) ou par produit.' },
      { term: 'Neuf / Occasion / Reconditionné', label: 'État du produit', description: '« Neuf » : produit jamais utilisé. « Occasion » : produit de seconde main. « Reconditionné » : produit remis en état par un technicien.' },
    ],
  },
  {
    id: 'sales',
    icon: FileText,
    title: 'Termes de vente',
    color: 'var(--orange-400)',
    items: [
      { term: 'Devis (DEV)', label: 'Proposition commerciale', description: 'Document pré-vente non définitif, envoyé au client pour validation. Peut être converti en facture définitive une fois accepté.' },
      { term: 'Facture', label: 'Document de vente', description: 'Document officiel généré automatiquement à chaque vente validée. Téléchargeable en PDF.' },
      { term: 'Annulation', label: 'Annulation de vente', description: 'Un administrateur — ou le vendeur à l\'origine de la vente — peut annuler une vente. Les quantités sont restituées automatiquement au stock via un mouvement « Annulation de vente » (sale_cancel), et le chiffre d\'affaires en est réduit.' },
      { term: 'POS', label: 'Point Of Sale (Caisse)', description: 'L\'interface d\'encaissement en temps réel. Seuls les produits actifs et en stock (quantité > 0) y sont affichés.' },
      { term: 'CA', label: 'Chiffre d\'Affaires', description: 'Total des prix de vente effectifs (unit_price × quantité) des ventes validées sur une période donnée, hors taxes. Visible dans les rapports et le tableau de bord.' },
      { term: 'Sous-total', label: 'Montant hors taxes', description: 'Somme des prix de vente effectifs de tous les articles d\'une vente, avant application de la TVA.' },
      { term: 'Réapprovisionnement', label: 'Entrée de stock', description: 'Ajout de quantité au stock d\'un produit. N\'enregistre plus de prix d\'achat : le prix de vente reste saisi à chaque vente.' },
    ],
  },
]

export default function LexiquePage() {
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState(null)

  const filtered = SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(item =>
      !search ||
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(sec => !activeSection || sec.id === activeSection)
   .filter(sec => sec.items.length > 0)

  const totalTerms = SECTIONS.reduce((n, s) => n + s.items.length, 0)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--blue-500), var(--orange-500))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={22} color="#fff" />
          </div>
          <div>
            <h1 className="page-title">Lexique</h1>
            <p className="page-subtitle">{totalTerms} termes et acronymes expliqués</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche + filtres section */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="input-wrapper" style={{ flex: 1, minWidth: 200, maxWidth: 400 }}>
          <Search size={15} className="input-icon" />
          <input
            className="input has-icon"
            placeholder="Rechercher un terme, un code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${!activeSection ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveSection(null)}
          >
            Tous
          </button>
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                className={`btn btn-sm ${activeSection === s.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveSection(s.id === activeSection ? null : s.id)}
              >
                <Icon size={13} />
                {s.title.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenu */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <HelpCircle size={36} />
          <h3>Aucun résultat</h3>
          <p>Essayez un autre terme de recherche</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {filtered.map(section => {
            const SectionIcon = section.icon
            return (
              <div key={section.id} className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: section.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <SectionIcon size={17} style={{ color: section.color }} />
                  </div>
                  <span className="card-title">{section.title}</span>
                  <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                    {section.items.length} terme{section.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ padding: '4px 0' }}>
                  {section.items.map((item, i) => {
                    const ItemIcon = item.icon
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '200px 1fr',
                          gap: 16,
                          padding: '14px 24px',
                          borderBottom: i < section.items.length - 1 ? '1px solid var(--border)' : 'none',
                          alignItems: 'start',
                        }}
                      >
                        <div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontFamily: 'var(--font-mono)', fontWeight: 700,
                            color: section.color, fontSize: '0.85rem',
                            marginBottom: 4,
                          }}>
                            {ItemIcon && <ItemIcon size={13} />}
                            {item.term}
                          </div>
                          {item.badge ? (
                            <span className={`badge ${item.badge.cls}`} style={{ fontSize: '0.7rem' }}>
                              {item.badge.text}
                            </span>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {item.label}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {item.description}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

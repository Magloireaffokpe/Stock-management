/**
 * CategoryTree.jsx
 * Arborescence récursive des catégories pour une boutique donnée.
 * Pas de N+1 : charge tout en une requête via /api/catalog/categories/tree/
 */
import React, { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Package } from 'lucide-react'
import { catalogAPI } from '../../api'
import toast from 'react-hot-toast'

export const MAX_CATEGORY_DEPTH = 4

// ─── Nœud récursif ──────────────────────────────────────────────────────────
function TreeNode({ node, depth, expandedIds, toggleExpand, onAddProduct, onAddCategory, isAdmin }) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const atMaxDepth = depth >= MAX_CATEGORY_DEPTH
  const indent = depth * 20

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: indent,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: 'var(--radius-sm)',
          transition: 'background 0.1s',
          userSelect: 'none',
        }}
        className="cat-tree-row"
      >
        {/* Chevron expand/collapse */}
        <button
          className="btn btn-ghost btn-icon"
          style={{ width: 22, height: 22, padding: 0, flexShrink: 0, opacity: hasChildren ? 1 : 0.15 }}
          onClick={() => hasChildren && toggleExpand(node.id)}
          disabled={!hasChildren}
          aria-label={isExpanded ? 'Réduire' : 'Développer'}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>

        {/* Icône dossier */}
        <span style={{ color: node.color || 'var(--blue-600)', flexShrink: 0 }}>
          {hasChildren && isExpanded
            ? <FolderOpen size={15} />
            : <Folder size={15} />
          }
        </span>

        {/* Nom */}
        <span
          style={{
            flex: 1,
            fontWeight: depth === 0 ? 600 : 500,
            fontSize: depth === 0 ? '0.875rem' : '0.82rem',
            color: 'var(--text-primary)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </span>

        {/* Badge nb produits */}
        {node.product_count > 0 && (
          <span style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            background: 'var(--bg-hover)',
            borderRadius: 8,
            padding: '1px 6px',
            flexShrink: 0,
          }}>
            <Package size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
            {node.product_count}
          </span>
        )}

        {/* Boutons contextuels (admin seulement) */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0 }} className="cat-tree-actions">
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: '0.72rem', height: 24 }}
              onClick={() => onAddProduct(node)}
              title="Ajouter un produit dans cette catégorie"
            >
              <Plus size={11} style={{ marginRight: 3 }} />
              Produit
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                padding: '2px 8px',
                fontSize: '0.72rem',
                height: 24,
                opacity: atMaxDepth ? 0.4 : 1,
                cursor: atMaxDepth ? 'not-allowed' : 'pointer',
              }}
              onClick={() => !atMaxDepth && onAddCategory(node)}
              disabled={atMaxDepth}
              title={atMaxDepth
                ? `Profondeur maximale (${MAX_CATEGORY_DEPTH} niveaux) atteinte`
                : 'Ajouter une sous-catégorie'}
            >
              <Plus size={11} style={{ marginRight: 3 }} />
              Sous-cat.
            </button>
          </div>
        )}
      </div>

      {/* Enfants récursifs */}
      {hasChildren && isExpanded && (
        <div style={{ borderLeft: '1.5px solid var(--border)', marginLeft: indent + 11 }}>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onAddProduct={onAddProduct}
              onAddCategory={onAddCategory}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function CategoryTree({ storeId, onAddProduct, onAddCategory, isAdmin = true, refreshKey = 0 }) {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState(new Set())

  const loadTree = useCallback(async () => {
    if (!storeId) { setTree([]); return }
    setLoading(true)
    try {
      const res = await catalogAPI.categoryTree(storeId)
      const data = res.data ?? []
      setTree(data)
      // Auto-expand first level
      setExpandedIds(new Set(data.map(n => n.id)))
    } catch {
      toast.error('Erreur chargement de l\'arborescence')
    } finally {
      setLoading(false)
    }
  }, [storeId, refreshKey])

  useEffect(() => { loadTree() }, [loadTree])

  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  if (!storeId) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Sélectionnez une boutique pour afficher son arborescence.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <Folder size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
        Aucune catégorie dans cette boutique.
        {isAdmin && onAddCategory && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onAddCategory(null)}
            >
              <Plus size={14} /> Créer la première catégorie
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <style>{`
        .cat-tree-row:hover { background: var(--bg-hover); }
        .cat-tree-row:hover .cat-tree-actions { opacity: 1 !important; }
        .cat-tree-actions { transition: opacity 0.15s; }
      `}</style>
      <div style={{ padding: '4px 0' }}>
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            onAddProduct={onAddProduct}
            onAddCategory={onAddCategory}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes } from '../lib/api'
import type { Recipe } from '../lib/types'
import BottomNav from '../components/BottomNav'
import { EmptyState } from '../components/common'

const AMBER_STRIPES =
  'repeating-linear-gradient(135deg,#FFDDB3,#FFDDB3 12px,#FBEAD0 12px,#FBEAD0 24px)'

export default function Recipes() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchRecipes()
      .then(setRecipes)
      .finally(() => setLoading(false))
  }, [])

  // Search by title OR ingredient name (US9 critère d'acceptation).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.recipe_ingredients?.some((i) => i.name.toLowerCase().includes(q)),
    )
  }, [recipes, query])

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="t-headline" style={{ fontSize: 24, fontWeight: 800 }}>Recettes</span>
        <button className="icon-btn" aria-label="Importer une recette" onClick={() => navigate('/recettes/import')}>＋</button>
      </header>

      <div className="screen" style={{ padding: '0 16px 110px' }}>
        {/* Import CTA (tertiary / recettes accent) */}
        <button
          className="btn btn--block"
          style={{ background: 'var(--tertiary-container)', color: 'var(--on-tertiary-container)', marginBottom: 16 }}
          onClick={() => navigate('/recettes/import')}
        >
          <span style={{ fontSize: 18 }}>📷</span> Importer depuis Instagram / Reels
        </button>

        <div className="search" style={{ marginBottom: 16 }}>
          <span style={{ color: 'var(--muted)' }}>🔍</span>
          <input placeholder="Rechercher par nom ou ingrédient…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="center" style={{ padding: 48 }}><span className="spinner spinner--lg" /></div>
        ) : visible.length === 0 ? (
          <EmptyState emoji="📖" title={recipes.length === 0 ? 'Aucune recette' : 'Aucun résultat'}>
            {recipes.length === 0
              ? 'Importez une recette depuis Instagram pour la retrouver ici.'
              : 'Essayez un autre nom ou ingrédient.'}
          </EmptyState>
        ) : (
          <div className="col gap-12">
            {visible.map((r) => (
              <button
                key={r.id}
                className="card"
                style={{ overflow: 'hidden', textAlign: 'left', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => navigate(`/recettes/${r.id}`)}
              >
                <div style={{ height: 120, background: r.image_url ? `center/cover url(${r.image_url})` : AMBER_STRIPES, position: 'relative' }}>
                  {r.favorite && (
                    <span className="center" style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '9999px', background: 'rgba(255,255,255,.92)', fontSize: 16 }}>❤️</span>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  <span className="badge" style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}>
                    📷 {r.source === 'instagram' ? "Importé d'Instagram" : 'Importée'}
                  </span>
                  <h3 className="t-title-l" style={{ margin: '10px 0 4px' }}>{r.title}</h3>
                  <p className="t-body-m" style={{ margin: 0 }}>
                    {r.recipe_ingredients?.length ?? 0} ingrédient{(r.recipe_ingredients?.length ?? 0) > 1 ? 's' : ''}
                    {r.steps?.length ? ` · ${r.steps.length} étape${r.steps.length > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

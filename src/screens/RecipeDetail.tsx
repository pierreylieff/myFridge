import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { addIngredientsToList, deleteRecipe, fetchRecipe, toggleFavorite } from '../lib/api'
import { RAYONS } from '../lib/constants'
import type { Recipe } from '../lib/types'

const AMBER_STRIPES =
  'repeating-linear-gradient(135deg,#FFDDB3,#FFDDB3 12px,#FBEAD0 12px,#FBEAD0 24px)'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchRecipe(id)
      .then(setRecipe)
      .finally(() => setLoading(false))
  }, [id])

  async function addAll() {
    if (!user || !recipe?.recipe_ingredients?.length) return
    setBusy(true)
    try {
      const n = await addIngredientsToList(user.id, recipe.recipe_ingredients)
      show(`${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la liste`, {
        actionLabel: 'Voir',
        onAction: () => navigate('/'),
      })
    } catch {
      show('Erreur — réessayez')
    } finally {
      setBusy(false)
    }
  }

  async function fav() {
    if (!recipe) return
    const next = !recipe.favorite
    setRecipe({ ...recipe, favorite: next })
    await toggleFavorite(recipe.id, next)
  }

  async function remove() {
    if (!recipe) return
    await deleteRecipe(recipe.id)
    show('Recette supprimée')
    navigate('/recettes', { replace: true })
  }

  if (loading) {
    return <div className="app-shell"><div className="screen center"><span className="spinner spinner--lg" /></div></div>
  }
  if (!recipe) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="icon-btn" aria-label="Retour" onClick={() => navigate('/recettes')}>←</button>
          <span className="t-title-l">Recette</span><span style={{ width: 40 }} />
        </header>
        <div className="screen center"><p className="t-body-m">Recette introuvable.</p></div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="screen" style={{ padding: '0 0 110px' }}>
        {/* Hero */}
        <div style={{ height: 180, background: recipe.image_url ? `center/cover url(${recipe.image_url})` : AMBER_STRIPES, position: 'relative' }}>
          <button className="icon-btn" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,.92)' }} aria-label="Retour" onClick={() => navigate('/recettes')}>←</button>
          <button className="icon-btn" style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,.92)' }} aria-label="Favori" onClick={fav}>{recipe.favorite ? '❤️' : '🤍'}</button>
        </div>

        <div style={{ padding: '18px 16px 0' }}>
          {recipe.source_url ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer" className="badge" style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}>
              📷 Source Instagram
            </a>
          ) : (
            <span className="badge" style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}>📷 Importée</span>
          )}
          <h1 className="t-headline" style={{ margin: '12px 0 4px' }}>{recipe.title}</h1>
          <p className="t-body-m" style={{ margin: 0 }}>
            {recipe.recipe_ingredients?.length ?? 0} ingrédients
            {recipe.steps?.length ? ` · ${recipe.steps.length} étapes` : ''}
          </p>

          {/* Ingredients */}
          <div className="t-section" style={{ margin: '24px 2px 12px' }}>Ingrédients</div>
          <div className="card">
            {(recipe.recipe_ingredients ?? []).map((ing, idx, arr) => {
              const rayon = RAYONS[ing.rayon]
              return (
                <div key={ing.id}>
                  <div className="row gap-12" style={{ padding: '12px 14px' }}>
                    <span className="thumb" style={{ background: rayon.container, width: 36, height: 36, fontSize: 18 }}>{rayon.emoji}</span>
                    <span className="grow t-title-m">{ing.name}</span>
                    <span className="t-body-m">{ing.quantity} {ing.unit === 'piece' ? 'pc' : ing.unit}</span>
                  </div>
                  {idx < arr.length - 1 && <div className="divider" style={{ margin: '0 14px' }} />}
                </div>
              )
            })}
          </div>

          {/* Steps */}
          {recipe.steps?.length > 0 && (
            <>
              <div className="t-section" style={{ margin: '24px 2px 12px' }}>Préparation</div>
              <div className="col gap-12">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="row gap-12" style={{ alignItems: 'flex-start' }}>
                    <span className="center" style={{ width: 26, height: 26, flex: 'none', borderRadius: '9999px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                    <span className="t-body-l" style={{ flex: 1 }}>{step}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Delete */}
          {!confirmDelete ? (
            <button className="btn btn--danger-text btn--block" style={{ marginTop: 28 }} onClick={() => setConfirmDelete(true)}>
              Supprimer la recette
            </button>
          ) : (
            <div className="col gap-12" style={{ marginTop: 28 }}>
              <button className="btn btn--danger btn--block" onClick={remove}>Confirmer la suppression</button>
              <button className="btn btn--text btn--block" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky add-to-list (1 tap) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--surface-highest)' }}>
        <button className="btn btn--filled btn--block" onClick={addAll} disabled={busy || !recipe.recipe_ingredients?.length}>
          {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Ajouter les ingrédients à la liste'}
        </button>
      </div>
    </div>
  )
}

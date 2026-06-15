import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { invokeFunction } from '../lib/functions'
import { addIngredientsToList, saveRecipe } from '../lib/api'
import { RAYONS, RAYON_ORDER } from '../lib/constants'
import type { ImportedRecipe, Rayon } from '../lib/types'

type Phase = 'input' | 'analyzing' | 'review'

export default function ImportRecipe() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const [phase, setPhase] = useState<Phase>('input')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [recipe, setRecipe] = useState<ImportedRecipe | null>(null)
  const [busy, setBusy] = useState(false)

  async function analyze() {
    if (!text.trim() && !url.trim()) return
    setPhase('analyzing')
    const { data, code } = await invokeFunction<{ recipe: ImportedRecipe }>('import-recipe', { text, url })
    if (code) {
      if (code === 'missing_api_key') show('Clé Claude non configurée côté serveur (voir README).')
      else if (code === 'no_content') show('Collez la légende du post à analyser.')
      else show("L'extraction a échoué. Réessayez.")
      setPhase('input')
      return
    }
    const r = (data?.recipe ?? { title: '', ingredients: [], steps: [] }) as ImportedRecipe
    setRecipe(r)
    setPhase('review')
  }

  function patchIng(idx: number, p: Partial<ImportedRecipe['ingredients'][number]>) {
    if (!recipe) return
    setRecipe({ ...recipe, ingredients: recipe.ingredients.map((ing, i) => (i === idx ? { ...ing, ...p } : ing)) })
  }
  function removeIng(idx: number) {
    if (!recipe) return
    setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== idx) })
  }

  async function save(alsoAddToList: boolean) {
    if (!user || !recipe) return
    setBusy(true)
    try {
      await saveRecipe(user.id, recipe, url.trim() || null)
      if (alsoAddToList && recipe.ingredients.length) {
        await addIngredientsToList(user.id, recipe.ingredients)
      }
      show(alsoAddToList ? 'Recette enregistrée et ajoutée à la liste' : 'Recette enregistrée')
      navigate(alsoAddToList ? '/' : '/recettes', { replace: true })
    } catch {
      show('Erreur — réessayez')
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Retour" onClick={() => navigate('/recettes')}>←</button>
        <span className="t-title-l">Importer une recette</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="screen screen--padded">
        {phase === 'input' && (
          <>
            <div className="card" style={{ padding: 16, marginBottom: 18, background: 'var(--tertiary-container)', boxShadow: 'none' }}>
              <p className="t-body-m" style={{ margin: 0, color: 'var(--on-tertiary-container)' }}>
                Depuis Instagram : <strong>Partager → Copier le lien</strong>, ou copiez la légende du post,
                puis collez-la ci-dessous. L'IA en extrait les ingrédients.
              </p>
            </div>

            <div className={`field${url ? ' field--filled' : ''}`}>
              <input className="field__input" placeholder="https://instagram.com/p/…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <label className="field__label">Lien du post (optionnel)</label>
            </div>

            <div className={`field${text ? ' field--filled' : ''}`}>
              <textarea
                className="field__input"
                style={{ minHeight: 180, resize: 'vertical' }}
                placeholder="Collez ici la légende / le texte de la recette…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <label className="field__label">Texte de la recette</label>
            </div>

            <button className="btn btn--filled btn--block" onClick={analyze} disabled={!text.trim() && !url.trim()}>
              Analyser la recette
            </button>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="center col" style={{ gap: 16, padding: '72px 0' }}>
            <span className="spinner spinner--lg" />
            <span className="t-title-m">Extraction des ingrédients…</span>
            <span className="t-body-m">L'IA lit la recette</span>
          </div>
        )}

        {phase === 'review' && recipe && (
          <>
            <div className="field field--filled">
              <input className="field__input" value={recipe.title} onChange={(e) => setRecipe({ ...recipe, title: e.target.value })} />
              <label className="field__label">Titre de la recette</label>
            </div>

            <div className="t-section" style={{ margin: '8px 2px 12px' }}>
              Ingrédients · {recipe.ingredients.length}
            </div>

            {recipe.ingredients.length === 0 && (
              <p className="t-body-m" style={{ marginBottom: 12 }}>
                Aucun ingrédient détecté. Ajoutez-les manuellement depuis la liste, ou réessayez avec plus de texte.
              </p>
            )}

            <div className="col gap-12">
              {recipe.ingredients.map((ing, idx) => (
                <div key={idx} className="card" style={{ padding: 12 }}>
                  <div className="row gap-8" style={{ marginBottom: 10 }}>
                    <input
                      className="field__input"
                      style={{ minHeight: 40, padding: '8px 12px' }}
                      value={ing.name}
                      onChange={(e) => patchIng(idx, { name: e.target.value })}
                    />
                    <button className="icon-btn" style={{ background: 'transparent', color: 'var(--error)' }} aria-label="Retirer" onClick={() => removeIng(idx)}>🗑️</button>
                  </div>
                  <div className="row gap-8">
                    <input
                      className="field__input"
                      type="number"
                      step="0.5"
                      min="0"
                      style={{ minHeight: 40, padding: '8px 12px', width: 80 }}
                      value={ing.quantity}
                      onChange={(e) => patchIng(idx, { quantity: Number(e.target.value) || 1 })}
                    />
                    <select
                      className="field__input"
                      style={{ minHeight: 40, padding: '8px 12px', width: 'auto', appearance: 'auto' }}
                      value={ing.rayon}
                      onChange={(e) => patchIng(idx, { rayon: e.target.value as Rayon })}
                    >
                      {RAYON_ORDER.map((r) => <option key={r} value={r}>{RAYONS[r].emoji} {RAYONS[r].label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="col gap-12" style={{ marginTop: 24 }}>
              <button className="btn btn--filled btn--block" onClick={() => save(true)} disabled={busy}>
                {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Enregistrer + ajouter à la liste'}
              </button>
              <button className="btn btn--tonal btn--block" onClick={() => save(false)} disabled={busy}>
                Enregistrer la recette seulement
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

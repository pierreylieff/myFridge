import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import {
  addItem,
  deleteItem,
  getOrCreateActiveList,
  updateItem,
  addOrMergePantryItem,
  deletePantryItem,
  getOrCreatePantry,
  updatePantryItem,
} from '../lib/api'
import { RAYONS, RAYON_ORDER, UNITS } from '../lib/constants'
import { guessRayon, searchProducts } from '../lib/products'
import type { ListItem, PantryItem, Rayon } from '../lib/types'

type Mode = 'list' | 'stock'

export default function AddEditItem({ mode = 'list' }: { mode?: Mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = id !== 'new' && id != null
  const isStock = mode === 'stock'
  const backTo = isStock ? '/stock' : '/'
  const { user } = useAuth()
  const { show } = useToast()

  const [name, setName] = useState('')
  const [rayon, setRayon] = useState<Rayon>('autre')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('piece')
  const [target, setTarget] = useState('') // cible optionnelle (mode stock)
  const [touchedRayon, setTouchedRayon] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    const table = isStock ? 'pantry_items' : 'list_items'
    supabase
      .from(table)
      .select('*')
      .eq('id', id!)
      .single()
      .then(({ data }) => {
        if (data) {
          const it = data as ListItem | PantryItem
          setName(it.name)
          setRayon(it.rayon)
          setQuantity(String(it.quantity))
          setUnit(it.unit)
          if (isStock) {
            const t = (it as PantryItem).target_qty
            setTarget(t == null ? '' : String(t))
          }
          setTouchedRayon(true)
        }
        setLoading(false)
      })
  }, [id, isEdit, isStock])

  const suggestions = !isEdit ? searchProducts(name) : []

  function pickSuggestion(s: { name: string; rayon: Rayon; unit?: string }) {
    setName(s.name)
    setRayon(s.rayon)
    setTouchedRayon(true)
    if (s.unit) setUnit(s.unit)
  }

  async function save() {
    if (!user || !name.trim()) return
    setBusy(true)
    const qty = Number(quantity.replace(',', '.')) || 1
    const targetQty = target.trim() === '' ? null : Number(target.replace(',', '.'))
    try {
      if (isStock) {
        if (isEdit) {
          await updatePantryItem(id!, { name: name.trim(), rayon, quantity: qty, unit, target_qty: targetQty })
          show('Produit modifié')
        } else {
          const pantryId = await getOrCreatePantry(user.id)
          await addOrMergePantryItem(pantryId, user.id, { name, rayon, quantity: qty, unit, target_qty: targetQty })
          show('Produit ajouté au stock')
        }
      } else {
        if (isEdit) {
          await updateItem(id!, { name: name.trim(), rayon, quantity: qty, unit })
          show('Article modifié')
        } else {
          const listId = await getOrCreateActiveList(user.id)
          await addItem(listId, user.id, { name, rayon, quantity: qty, unit, origin: 'manuel' })
          show('Article ajouté')
        }
      }
      navigate(backTo, { replace: true })
    } catch {
      show('Erreur — réessayez')
      setBusy(false)
    }
  }

  async function remove() {
    if (!isEdit) return
    setBusy(true)
    try {
      if (isStock) await deletePantryItem(id!)
      else await deleteItem(id!)
      show(isStock ? 'Produit supprimé' : 'Article supprimé')
      navigate(backTo, { replace: true })
    } catch {
      show('Suppression impossible')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="screen center"><span className="spinner spinner--lg" /></div>
      </div>
    )
  }

  const title = isEdit
    ? isStock ? 'Modifier le produit' : 'Modifier'
    : isStock ? 'Nouveau produit' : 'Nouvel article'
  const saveLabel = isEdit ? 'Enregistrer' : isStock ? 'Ajouter au stock' : 'Ajouter à la liste'

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Retour" onClick={() => navigate(-1)}>←</button>
        <span className="t-title-l">{title}</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="screen screen--padded">
        {/* Name + autocomplete */}
        <div style={{ position: 'relative' }}>
          <div className={`field${name ? ' field--filled' : ''}`}>
            <input
              className="field__input"
              autoFocus={!isEdit}
              placeholder="Ex. Yaourt nature"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!touchedRayon) setRayon(guessRayon(e.target.value))
              }}
            />
            <label className="field__label">Nom du produit</label>
          </div>
          {suggestions.length > 0 && (
            <div className="card" style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 5, overflow: 'hidden' }}>
              {suggestions.map((s, i) => (
                <button
                  key={s.name}
                  className="row gap-12"
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 14px', borderTop: i ? '1px solid var(--surface-container)' : 'none', textAlign: 'left',
                  }}
                  onClick={() => pickSuggestion(s)}
                >
                  <span className="thumb" style={{ background: RAYONS[s.rayon].container, width: 32, height: 32, fontSize: 16 }}>
                    {RAYONS[s.rayon].emoji}
                  </span>
                  <span className="t-title-m">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity + unit */}
        <div className="row gap-12" style={{ alignItems: 'stretch' }}>
          <div className="field field--filled" style={{ flex: 1, marginBottom: 18 }}>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <label className="field__label">{isStock ? "Quantité (j'ai)" : 'Quantité'}</label>
          </div>
          <div className="field field--filled" style={{ flex: 1, marginBottom: 18 }}>
            <select
              className="field__input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ appearance: 'auto' }}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u === 'piece' ? 'pièce' : u}</option>
              ))}
            </select>
            <label className="field__label">Unité</label>
          </div>
        </div>

        {/* Cible optionnelle (mode stock uniquement) */}
        {isStock && (
          <>
            <div className="field field--filled" style={{ marginBottom: 6 }}>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                placeholder=""
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <label className="field__label">Quantité souhaitée (cible) — optionnel</label>
            </div>
            <p className="t-body-m" style={{ fontSize: 12, color: 'var(--muted)', margin: '0 2px 18px' }}>
              Définissez une cible pour un réassort automatique aux courses. Sinon, marquez « à racheter »
              depuis votre stock quand c'est nécessaire.
            </p>
          </>
        )}

        {/* Rayon */}
        <div className="t-label" style={{ color: 'var(--on-surface-variant)', margin: '4px 2px 12px' }}>Rayon</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {RAYON_ORDER.map((r) => (
            <button
              key={r}
              className={`chip${rayon === r ? ' chip--selected' : ''}`}
              onClick={() => {
                setRayon(r)
                setTouchedRayon(true)
              }}
            >
              <span>{RAYONS[r].emoji}</span> {RAYONS[r].label}
            </button>
          ))}
        </div>

        <div className="col gap-12" style={{ marginTop: 32 }}>
          <button className="btn btn--filled btn--block" onClick={save} disabled={busy || !name.trim()}>
            {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : saveLabel}
          </button>
          {isEdit && (
            <button className="btn btn--danger-text btn--block" onClick={remove} disabled={busy}>
              {isStock ? 'Supprimer le produit' : "Supprimer l'article"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { addItem, deleteItem, getOrCreateActiveList, updateItem } from '../lib/api'
import { RAYONS, RAYON_ORDER, UNITS } from '../lib/constants'
import { guessRayon, searchProducts } from '../lib/products'
import type { ListItem, Rayon } from '../lib/types'

export default function AddEditItem() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = id !== 'new' && id != null
  const { user } = useAuth()
  const { show } = useToast()

  const [name, setName] = useState('')
  const [rayon, setRayon] = useState<Rayon>('autre')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('piece')
  const [touchedRayon, setTouchedRayon] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    supabase
      .from('list_items')
      .select('*')
      .eq('id', id!)
      .single()
      .then(({ data }) => {
        if (data) {
          const it = data as ListItem
          setName(it.name)
          setRayon(it.rayon)
          setQuantity(String(it.quantity))
          setUnit(it.unit)
          setTouchedRayon(true)
        }
        setLoading(false)
      })
  }, [id, isEdit])

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
    try {
      if (isEdit) {
        await updateItem(id!, { name: name.trim(), rayon, quantity: qty, unit })
        show('Article modifié')
      } else {
        const listId = await getOrCreateActiveList(user.id)
        await addItem(listId, user.id, { name, rayon, quantity: qty, unit, origin: 'manuel' })
        show('Article ajouté')
      }
      navigate('/', { replace: true })
    } catch {
      show('Erreur — réessayez')
      setBusy(false)
    }
  }

  async function remove() {
    if (!isEdit) return
    setBusy(true)
    try {
      await deleteItem(id!)
      show('Article supprimé')
      navigate('/', { replace: true })
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Retour" onClick={() => navigate(-1)}>←</button>
        <span className="t-title-l">{isEdit ? 'Modifier' : 'Nouvel article'}</span>
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
            <label className="field__label">Quantité</label>
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
            {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : isEdit ? 'Enregistrer' : 'Ajouter à la liste'}
          </button>
          {isEdit && (
            <button className="btn btn--danger-text btn--block" onClick={remove} disabled={busy}>
              Supprimer l'article
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

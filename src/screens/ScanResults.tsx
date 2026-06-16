import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { addOrMergePantryItem, getOrCreatePantry } from '../lib/api'
import { RAYONS, RAYON_ORDER, UNITS, CONFIDENCE_THRESHOLD } from '../lib/constants'
import { ConfidenceBar, EmptyState } from '../components/common'
import type { DetectedProduct, Rayon, ScanType } from '../lib/types'

interface Editable extends DetectedProduct {
  _id: number
  checked: boolean
  editing: boolean
}

export default function ScanResults() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { show } = useToast()

  const state = location.state as { products?: DetectedProduct[]; type?: ScanType } | null
  const [rows, setRows] = useState<Editable[]>(() =>
    (state?.products ?? []).map((p, i) => ({
      ...p,
      _id: i,
      // PRD seuil de confiance : sous 70 %, non coché par défaut.
      checked: p.confidence >= CONFIDENCE_THRESHOLD,
      editing: false,
    })),
  )
  const [busy, setBusy] = useState(false)

  const selectedCount = rows.filter((r) => r.checked).length

  function patch(id: number, p: Partial<Editable>) {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...p } : r)))
  }

  async function validate() {
    if (!user || selectedCount === 0) return
    setBusy(true)
    try {
      const pantryId = await getOrCreatePantry(user.id)
      for (const r of rows.filter((r) => r.checked)) {
        await addOrMergePantryItem(pantryId, user.id, {
          name: r.name,
          rayon: r.rayon,
          quantity: r.quantity,
          unit: r.unit,
          source: 'ia',
        })
      }
      show(`${selectedCount} produit${selectedCount > 1 ? 's' : ''} ajouté${selectedCount > 1 ? 's' : ''} à votre stock`)
      navigate('/stock', { replace: true })
    } catch {
      show('Erreur — réessayez')
      setBusy(false)
    }
  }

  const allFresh = useMemo(() => rows.length > 0, [rows])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Retour" onClick={() => navigate('/scanner', { replace: true })}>←</button>
        <span className="t-title-l">Résultats</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="screen" style={{ padding: '0 16px 120px' }}>
        {!allFresh ? (
          <EmptyState emoji="🔍" title="Aucun produit détecté">
            Réessayez avec une meilleure lumière et un cadrage net, ou ajoutez vos articles manuellement.
          </EmptyState>
        ) : (
          <>
            <p className="t-body-m" style={{ margin: '8px 6px 16px' }}>
              L'IA propose, vous validez. Les détections sous {Math.round(CONFIDENCE_THRESHOLD * 100)} % ne sont pas
              cochées — vérifiez-les avant d'ajouter.
            </p>

            <div className="card" style={{ padding: 4 }}>
              {rows.map((r, idx) => {
                const rayon = RAYONS[r.rayon]
                return (
                  <div key={r._id}>
                    <div className="row gap-12" style={{ padding: '14px' }}>
                      <button
                        className={`checkbox${r.checked ? ' checkbox--checked' : ''}`}
                        aria-pressed={r.checked}
                        onClick={() => patch(r._id, { checked: !r.checked })}
                      >
                        {r.checked ? '✓' : ''}
                      </button>
                      <span className="thumb" style={{ background: rayon.container, width: 44, height: 44, borderRadius: 12, fontSize: 22 }}>
                        {rayon.emoji}
                      </span>
                      <div className="grow col">
                        <span className="t-title-m">
                          {r.name} · {Number.isInteger(r.quantity) ? r.quantity : r.quantity} {r.unit === 'piece' ? 'pc' : r.unit}
                        </span>
                        <ConfidenceBar value={r.confidence} />
                      </div>
                      <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Modifier" onClick={() => patch(r._id, { editing: !r.editing })}>
                        ✎
                      </button>
                    </div>

                    {r.editing && (
                      <div style={{ padding: '0 14px 16px 50px' }}>
                        {/* Quantity stepper + unit */}
                        <div className="row gap-12" style={{ marginBottom: 12 }}>
                          <div className="row" style={{ border: '1.5px solid var(--outline)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <button className="icon-btn" style={{ background: 'transparent', borderRadius: 0 }} onClick={() => patch(r._id, { quantity: Math.max(0.5, r.quantity - 0.5) })}>−</button>
                            <span className="center" style={{ minWidth: 44, fontWeight: 700 }}>{r.quantity}</span>
                            <button className="icon-btn" style={{ background: 'transparent', borderRadius: 0 }} onClick={() => patch(r._id, { quantity: r.quantity + 0.5 })}>＋</button>
                          </div>
                          <select
                            className="field__input"
                            style={{ minHeight: 40, padding: '8px 12px', width: 'auto', appearance: 'auto' }}
                            value={r.unit}
                            onChange={(e) => patch(r._id, { unit: e.target.value })}
                          >
                            {UNITS.map((u) => <option key={u} value={u}>{u === 'piece' ? 'pièce' : u}</option>)}
                          </select>
                        </div>
                        {/* Rayon */}
                        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                          {RAYON_ORDER.map((rr) => (
                            <button
                              key={rr}
                              className={`chip${r.rayon === rr ? ' chip--selected' : ''}`}
                              style={{ padding: '6px 12px', fontSize: 13 }}
                              onClick={() => patch(r._id, { rayon: rr as Rayon })}
                            >
                              {RAYONS[rr].emoji} {RAYONS[rr].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {idx < rows.length - 1 && <div className="divider" style={{ margin: '0 14px' }} />}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Validation bar */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          background: 'var(--surface)', borderTop: '1px solid var(--surface-highest)',
        }}
      >
        {allFresh ? (
          <button className="btn btn--filled btn--block" onClick={validate} disabled={busy || selectedCount === 0}>
            {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : `Valider la sélection (${selectedCount})`}
          </button>
        ) : (
          <button className="btn btn--filled btn--block" onClick={() => navigate('/scanner', { replace: true })}>
            Reprendre une photo
          </button>
        )}
      </div>
    </div>
  )
}

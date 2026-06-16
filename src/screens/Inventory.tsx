import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  getOrCreatePantry,
  fetchPantryItems,
  updatePantryItem,
  setRestock,
  restockDeficit,
  syncListFromInventory,
} from '../lib/api'
import { RAYONS, RAYON_ORDER, RAYON_LOCATION } from '../lib/constants'
import type { PantryItem, Rayon } from '../lib/types'
import BottomNav from '../components/BottomNav'
import { EmptyState } from '../components/common'

function unitLabel(qty: number, unit: string) {
  if (unit === 'piece') return qty > 1 ? 'pièces' : 'pièce'
  return unit
}

export default function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { show } = useToast()
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Rayon | 'all'>('all')
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const id = await getOrCreatePantry(user.id)
    setItems(await fetchPantryItems(id))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Optimistic patch helper with rollback on network error.
  async function patch(item: PantryItem, next: Partial<PantryItem>) {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...next } : it)))
    try {
      await updatePantryItem(item.id, next)
    } catch {
      show('Erreur réseau — modification annulée')
      void load()
    }
  }

  async function changeQty(item: PantryItem, delta: number) {
    const next = Math.max(0, Number(item.quantity) + delta)
    await patch(item, { quantity: next })
  }

  async function toggleRestock(item: PantryItem) {
    const next = !item.needs_restock
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, needs_restock: next } : it)))
    try {
      await setRestock(item.id, next)
    } catch {
      show('Erreur réseau — modification annulée')
      void load()
    }
  }

  async function completeList() {
    if (!user || syncing) return
    setSyncing(true)
    try {
      const n = await syncListFromInventory(user.id)
      if (n === 0) show('Rien à racheter — votre stock est complet 👍')
      else show(`${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} aux courses`)
    } catch {
      show('Erreur — réessayez')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.rayon === filter)),
    [items, filter],
  )

  const groups = useMemo(
    () =>
      RAYON_ORDER.map((r) => ({ rayon: r, items: filtered.filter((i) => i.rayon === r) })).filter(
        (g) => g.items.length > 0,
      ),
    [filtered],
  )

  const rayonsPresent = useMemo(() => {
    const set = new Set(items.map((i) => i.rayon))
    return RAYON_ORDER.filter((r) => set.has(r))
  }, [items])

  // Combien d'articles partiraient aux courses (déficit cible ou flag manuel).
  const toBuyCount = useMemo(() => items.filter((i) => restockDeficit(i) > 0).length, [items])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="t-label" style={{ color: 'var(--primary)' }}>
            Mon stock
          </div>
          <div className="t-headline" style={{ fontSize: 24, fontWeight: 800 }}>
            Ce que j'ai
          </div>
        </div>
        <div className="row gap-8">
          <button className="icon-btn" aria-label="Scanner" onClick={() => navigate('/scanner')}>📷</button>
          <button className="icon-btn" aria-label="Ajouter au stock" onClick={() => navigate('/stock/item/new')}>＋</button>
        </div>
      </header>

      {/* Filter chips */}
      <div className="row gap-8" style={{ padding: '0 16px 12px', overflowX: 'auto' }}>
        <button className={`chip${filter === 'all' ? ' chip--selected' : ''}`} onClick={() => setFilter('all')}>
          {filter === 'all' ? '✓ ' : ''}Tout · {items.length}
        </button>
        {rayonsPresent.map((r) => (
          <button
            key={r}
            className={`chip${filter === r ? ' chip--selected' : ''}`}
            onClick={() => setFilter(filter === r ? 'all' : r)}
          >
            {RAYONS[r].label}
          </button>
        ))}
      </div>

      <div className="screen" style={{ padding: '0 16px 160px' }}>
        {loading ? (
          <div className="center" style={{ padding: 48 }}>
            <span className="spinner spinner--lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState emoji="📦" title="Votre stock est vide">
            Scannez votre frigo, vos placards ou votre congélateur pour le remplir, ou ajoutez un produit
            manuellement.
          </EmptyState>
        ) : (
          groups.map((g) => {
            const loc = RAYON_LOCATION[g.rayon]
            return (
              <section key={g.rayon} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: RAYONS[g.rayon].text,
                    padding: '8px 6px',
                  }}
                >
                  {RAYONS[g.rayon].emoji} {RAYONS[g.rayon].label}
                  {loc && <span style={{ color: 'var(--muted)', fontWeight: 600 }}> · {loc}</span>}
                </div>
                <div className="card">
                  {g.items.map((item, idx) => {
                    const rayon = RAYONS[item.rayon]
                    const deficit = restockDeficit(item)
                    const hasTarget = item.target_qty != null
                    return (
                      <div key={item.id}>
                        <div className="row gap-12" style={{ padding: '13px 14px' }}>
                          <button
                            className="row gap-12 grow"
                            style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                            onClick={() => navigate(`/stock/item/${item.id}`)}
                          >
                            <span className="thumb" style={{ background: rayon.container }}>{rayon.emoji}</span>
                            <span className="grow col">
                              <span className="t-title-m">{item.name}</span>
                              <span className="t-body-m" style={{ fontSize: 13 }}>
                                J'ai {item.quantity} {unitLabel(item.quantity, item.unit)}
                                {hasTarget && (
                                  <span style={{ color: 'var(--muted)' }}> · cible {item.target_qty}</span>
                                )}
                              </span>
                            </span>
                          </button>

                          {/* Quantity stepper (le « j'ai ») */}
                          <div
                            className="row"
                            style={{ border: '1.5px solid var(--outline)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}
                          >
                            <button
                              className="icon-btn"
                              aria-label="Diminuer"
                              style={{ background: 'transparent', borderRadius: 0, minWidth: 36 }}
                              onClick={() => changeQty(item, -1)}
                            >
                              −
                            </button>
                            <span className="center" style={{ minWidth: 28, fontWeight: 700 }}>{item.quantity}</span>
                            <button
                              className="icon-btn"
                              aria-label="Augmenter"
                              style={{ background: 'transparent', borderRadius: 0, minWidth: 36 }}
                              onClick={() => changeQty(item, +1)}
                            >
                              ＋
                            </button>
                          </div>
                        </div>

                        {/* Ligne "courses associées" : déficit cible OU toggle manuel */}
                        <div className="row gap-8" style={{ padding: '0 14px 12px 64px', alignItems: 'center' }}>
                          {hasTarget ? (
                            deficit > 0 ? (
                              <span
                                className="badge"
                                style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}
                              >
                                🛒 manque {deficit} {unitLabel(deficit, item.unit)}
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
                                ✓ stock complet
                              </span>
                            )
                          ) : (
                            <button
                              className={`chip${item.needs_restock ? ' chip--selected' : ''}`}
                              style={{ padding: '4px 12px', fontSize: 13 }}
                              onClick={() => toggleRestock(item)}
                            >
                              {item.needs_restock ? '✓ à racheter' : '🛒 à racheter'}
                            </button>
                          )}
                        </div>

                        {idx < g.items.length - 1 && <div className="divider" style={{ margin: '0 14px' }} />}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>

      {/* Pont vers les courses */}
      {!loading && items.length > 0 && (
        <button
          className="fab-extended"
          onClick={completeList}
          disabled={syncing}
        >
          {syncing ? (
            <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} />
          ) : (
            <>
              <span style={{ fontSize: 18 }}>🛒</span> Compléter les courses
              {toBuyCount > 0 ? ` (${toBuyCount})` : ''}
            </>
          )}
        </button>
      )}

      <BottomNav />
    </div>
  )
}

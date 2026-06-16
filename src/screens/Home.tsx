import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getOrCreateActiveList, fetchItems, updateItem, receiveIntoStock } from '../lib/api'
import { RAYONS, RAYON_ORDER } from '../lib/constants'
import type { ListItem, Rayon } from '../lib/types'
import ListItemRow from '../components/ListItemRow'
import BottomNav from '../components/BottomNav'
import { EmptyState } from '../components/common'

export default function Home() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { show } = useToast()
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Rayon | 'all'>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const id = await getOrCreateActiveList(user.id)
    setItems(await fetchItems(id))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(item: ListItem) {
    const next = !item.checked
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, checked: next } : it)))
    try {
      await updateItem(item.id, { checked: next })
      // Boucle de retour : un article coché « acheté » peut rejoindre le stock.
      if (next && user) {
        show('Article acheté', {
          actionLabel: 'Ajouter au stock',
          onAction: () => {
            void receiveIntoStock(user.id, {
              name: item.name,
              rayon: item.rayon,
              quantity: item.quantity,
              unit: item.unit,
            })
              .then(() => show('Ajouté à votre stock'))
              .catch(() => show('Erreur — réessayez'))
          },
        })
      }
    } catch {
      show('Erreur réseau — modification annulée')
      void load()
    }
  }

  // Filter + search
  const visible = useMemo(() => {
    let res = items
    if (filter !== 'all') res = res.filter((i) => i.rayon === filter)
    if (query.trim()) res = res.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
    return res
  }, [items, filter, query])

  // Group unchecked by rayon (in fixed order); checked items go to the bottom.
  const groups = useMemo(() => {
    const unchecked = visible.filter((i) => !i.checked)
    const checked = visible.filter((i) => i.checked)
    const byRayon = RAYON_ORDER.map((r) => ({ rayon: r, items: unchecked.filter((i) => i.rayon === r) })).filter(
      (g) => g.items.length > 0,
    )
    return { byRayon, checked }
  }, [visible])

  const rayonsPresent = useMemo(() => {
    const set = new Set(items.map((i) => i.rayon))
    return RAYON_ORDER.filter((r) => set.has(r))
  }, [items])

  const remaining = items.filter((i) => !i.checked).length

  return (
    <div className="app-shell">
      {/* Top app bar */}
      <header className="topbar">
        <div>
          <div className="t-label" style={{ color: 'var(--primary)' }}>
            Bonjour {profile?.full_name?.split(' ')[0] ?? ''} 👋
          </div>
          <div className="t-headline" style={{ fontSize: 24, fontWeight: 800 }}>Courses</div>
        </div>
        <div className="row gap-8">
          <button className="icon-btn" aria-label="Rechercher" onClick={() => setSearchOpen((s) => !s)}>🔍</button>
          <button className="icon-btn" aria-label="Ajouter un article" onClick={() => navigate('/item/new')}>＋</button>
        </div>
      </header>

      {searchOpen && (
        <div style={{ padding: '0 16px 8px' }}>
          <div className="search">
            <span style={{ color: 'var(--muted)' }}>🔍</span>
            <input
              autoFocus
              placeholder="Rechercher un produit…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="snackbar__action" style={{ color: 'var(--muted)' }} onClick={() => setQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="row gap-8" style={{ padding: '0 16px 12px', overflowX: 'auto' }}>
        <button className={`chip${filter === 'all' ? ' chip--selected' : ''}`} onClick={() => setFilter('all')}>
          {filter === 'all' ? '✓ ' : ''}Tous · {remaining}
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

      {/* List */}
      <div className="screen" style={{ padding: '0 16px 110px' }}>
        {loading ? (
          <div className="center" style={{ padding: 48 }}>
            <span className="spinner spinner--lg" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState emoji="🛒" title="Votre liste est vide">
            Votre liste se remplit depuis votre stock (« Compléter les courses ») ou vos recettes. Vous pouvez
            aussi ajouter un article directement.
          </EmptyState>
        ) : (
          <>
            {groups.byRayon.map((g) => (
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
                </div>
                <div className="card">
                  {g.items.map((item, idx) => (
                    <ListItemRow
                      key={item.id}
                      item={item}
                      last={idx === g.items.length - 1}
                      onToggle={() => toggle(item)}
                      onOpen={() => navigate(`/item/${item.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {groups.checked.length > 0 && (
              <section style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    padding: '8px 6px',
                  }}
                >
                  ✓ Achetés · {groups.checked.length}
                </div>
                <div className="card">
                  {groups.checked.map((item, idx) => (
                    <ListItemRow
                      key={item.id}
                      item={item}
                      last={idx === groups.checked.length - 1}
                      onToggle={() => toggle(item)}
                      onOpen={() => navigate(`/item/${item.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Extended FAB → Scanner */}
      <button className="fab-extended" onClick={() => navigate('/scanner')}>
        <span style={{ fontSize: 20 }}>📷</span> Scanner
      </button>

      <BottomNav />
    </div>
  )
}

import { RAYONS } from '../lib/constants'
import type { ListItem } from '../lib/types'

function formatQty(item: ListItem) {
  const unit = item.unit === 'piece' ? (item.quantity > 1 ? 'pièces' : 'pièce') : item.unit
  return `${item.quantity} ${unit}`
}

export default function ListItemRow({
  item,
  onToggle,
  onOpen,
  last,
}: {
  item: ListItem
  onToggle: () => void
  onOpen: () => void
  last?: boolean
}) {
  const rayon = RAYONS[item.rayon]
  return (
    <div>
      <div className={`row gap-12${item.checked ? ' fade' : ''}`} style={{ padding: '13px 14px' }}>
        <button
          className={`checkbox${item.checked ? ' checkbox--checked' : ''}`}
          aria-label={item.checked ? 'Décocher' : 'Cocher comme acheté'}
          aria-pressed={item.checked}
          onClick={onToggle}
        >
          {item.checked ? '✓' : ''}
        </button>

        <button
          className="row gap-12 grow"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
          onClick={onOpen}
        >
          <span className="thumb" style={{ background: rayon.container }}>{rayon.emoji}</span>
          <span className="grow col">
            <span className={`t-title-m${item.checked ? ' text-strike' : ''}`}>{item.name}</span>
            <span className="t-body-m" style={{ fontSize: 13 }}>{formatQty(item)}</span>
          </span>
        </button>

        {!item.checked && item.origin === 'ia' && item.confidence != null && (
          <span
            className="badge"
            style={{ background: 'var(--tertiary-container)', color: 'var(--tertiary)' }}
          >
            IA {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>
      {!last && <div className="divider" style={{ margin: '0 14px' }} />}
    </div>
  )
}

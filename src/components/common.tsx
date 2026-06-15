import type { ReactNode } from 'react'

// Logo tile "mF" used across cover, settings and auth screens.
export function LogoTile({ size = 52 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        background: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <span style={{ fontWeight: 800, fontSize: size * 0.42, color: '#fff', letterSpacing: '-0.5px' }}>mF</span>
    </div>
  )
}

// Full-screen centered loader.
export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="app-shell">
      <div className="screen center col gap-12" style={{ gap: 16 }}>
        <span className="spinner spinner--lg" />
        {label && <span className="t-body-m">{label}</span>}
      </div>
    </div>
  )
}

// Confidence bar (AI suggestions, US6).
export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const low = value < 0.7
  const color = low ? 'var(--tertiary)' : 'var(--primary)'
  return (
    <div className="row gap-8" style={{ marginTop: 6 }}>
      <div className="progress" style={{ flex: 1, maxWidth: 140 }}>
        <div className="progress__bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>
        {pct} %{low ? ' · à vérifier' : ''}
      </span>
    </div>
  )
}

// Generic empty / illustration state.
export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="center col" style={{ textAlign: 'center', padding: '56px 24px', gap: 10 }}>
      <div
        className="center"
        style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--primary-container)', fontSize: 34 }}
      >
        {emoji}
      </div>
      <h3 className="t-title-l" style={{ margin: '8px 0 0' }}>{title}</h3>
      {children && <p className="t-body-m" style={{ margin: 0, maxWidth: 280 }}>{children}</p>}
    </div>
  )
}

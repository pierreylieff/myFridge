import BottomNav from '../components/BottomNav'
import { EmptyState } from '../components/common'

export default function Placeholder({ title, emoji, text }: { title: string; emoji: string; text: string }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="t-headline" style={{ fontSize: 24, fontWeight: 800 }}>{title}</span>
      </header>
      <div className="screen center">
        <EmptyState emoji={emoji} title="Bientôt disponible">
          {text}
        </EmptyState>
      </div>
      <BottomNav />
    </div>
  )
}

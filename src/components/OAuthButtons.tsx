import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Provider } from '@supabase/supabase-js'

const PROVIDERS: { id: Provider; label: string; icon: string }[] = [
  { id: 'google', label: 'Google', icon: '🇬' },
  { id: 'apple', label: 'Apple', icon: '' },
  { id: 'facebook', label: 'Facebook', icon: 'f' },
  { id: 'azure', label: 'Microsoft', icon: '⊞' },
]

// Social sign-in. Each works once the matching provider is enabled in
// Supabase Auth. Until then the user sees a clear, non-blocking message.
// `redirectTo` lets callers (e.g. the OAuth consent page) come back to the
// exact URL after the provider round-trip; defaults to the app origin.
export function OAuthButtons({ redirectTo }: { redirectTo?: string } = {}) {
  const [note, setNote] = useState<string | null>(null)

  async function signInWith(id: Provider, label: string) {
    setNote(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: id,
      options: {
        redirectTo: redirectTo ?? window.location.origin,
        // Microsoft (azure) needs an explicit scope to return the email.
        scopes: id === 'azure' ? 'email openid profile' : undefined,
      },
    })
    if (error) setNote(`Connexion ${label} pas encore activée côté serveur.`)
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className="row gap-12" style={{ margin: '0 0 16px' }}>
        <span className="divider grow" />
        <span className="t-body-m">ou</span>
        <span className="divider grow" />
      </div>
      <div className="col gap-12">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className="btn btn--outlined btn--block"
            onClick={() => signInWith(p.id, p.label)}
            type="button"
          >
            <span style={{ fontSize: 18, fontWeight: 800, width: 20, display: 'inline-block', textAlign: 'center' }}>
              {p.icon}
            </span>
            Continuer avec {p.label}
          </button>
        ))}
      </div>
      {note && <p className="t-body-m" style={{ textAlign: 'center', marginTop: 12 }}>{note}</p>}
    </div>
  )
}

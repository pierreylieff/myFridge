import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoTile } from '../components/common'
import { OAuthButtons } from '../components/OAuthButtons'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError('Connexion impossible. Vérifiez vos identifiants.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <div className="screen screen--padded">
        <div className="col" style={{ alignItems: 'flex-start', gap: 16, padding: '40px 8px 24px' }}>
          <LogoTile />
          <div>
            <h1 className="t-display" style={{ margin: 0, color: 'var(--primary)' }}>Content de vous revoir</h1>
            <p className="t-body-l t-muted" style={{ margin: '4px 0 0' }}>
              Connectez-vous pour retrouver votre liste.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
          <div className="field">
            <input
              className="field__input"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="field__label">Email</label>
          </div>
          <div className="field">
            <input
              className="field__input"
              type="password"
              autoComplete="current-password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="field__label">Mot de passe</label>
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>{error}</p>
          )}

          <button className="btn btn--filled btn--block" disabled={busy} type="submit">
            {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Se connecter'}
          </button>
        </form>

        <OAuthButtons />

        <p className="t-body-m" style={{ textAlign: 'center', marginTop: 24 }}>
          Pas encore de compte ?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

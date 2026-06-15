import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogoTile } from '../components/common'
import { OAuthButtons } from '../components/OAuthButtons'

export default function Signup() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    setBusy(false)
    if (error) {
      setError(error.message.includes('already') ? 'Un compte existe déjà avec cet email.' : "L'inscription a échoué. Réessayez.")
      return
    }
    // If email confirmation is disabled, a session exists immediately → onboarding.
    // Otherwise prompt the user to confirm via the email they were sent.
    if (data.session) navigate('/onboarding', { replace: true })
    else setInfo('Compte créé ! Vérifiez votre email pour confirmer, puis connectez-vous.')
  }

  return (
    <div className="app-shell">
      <div className="screen screen--padded">
        <div className="col" style={{ alignItems: 'flex-start', gap: 16, padding: '40px 8px 24px' }}>
          <LogoTile />
          <div>
            <h1 className="t-display" style={{ margin: 0, color: 'var(--primary)' }}>Bienvenue&nbsp;!</h1>
            <p className="t-body-l t-muted" style={{ margin: '4px 0 0' }}>
              Créez votre compte en moins de 2 minutes.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
          <div className={`field${fullName ? ' field--filled' : ''}`}>
            <input
              className="field__input"
              type="text"
              autoComplete="name"
              placeholder="Camille Martin"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <label className="field__label">Nom</label>
          </div>
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
              autoComplete="new-password"
              placeholder="8 caractères minimum"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="field__label">Mot de passe</label>
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>{error}</p>
          )}
          {info && (
            <p style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>{info}</p>
          )}

          <button className="btn btn--filled btn--block" disabled={busy} type="submit">
            {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Créer mon compte'}
          </button>
        </form>

        <OAuthButtons />

        <p className="t-body-m" style={{ textAlign: 'center', marginTop: 24 }}>
          Déjà inscrit ?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

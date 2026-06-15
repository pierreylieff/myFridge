import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FullScreenLoader, LogoTile } from '../components/common'
import { OAuthButtons } from '../components/OAuthButtons'

// Écran de consentement OAuth 2.1 (authorization_url_path = "/oauth/consent").
// Supabase y redirige l'utilisateur pendant le flux d'autorisation d'un client
// externe (ex. Claude.ai). Il doit : (1) garantir une session, (2) afficher la
// demande, (3) approuver / refuser via supabase.auth.oauth.*.

// Libellés FR pour les scopes OpenID standard.
const SCOPE_LABELS: Record<string, string> = {
  openid: 'Vérifier votre identité',
  email: 'Votre adresse email',
  profile: 'Votre profil (nom)',
  phone: 'Votre numéro de téléphone',
}

export default function OAuthConsent() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const { loading: authLoading, session } = useAuth()

  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Charge les détails de la demande une fois l'utilisateur connecté.
  useEffect(() => {
    if (authLoading || !session || !authorizationId) return
    let active = true
    ;(async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (!active) return
      if (error) {
        setError("Cette demande d'autorisation est invalide ou expirée.")
        return
      }
      // Consentement déjà donné -> Supabase renvoie directement un redirect_url.
      if (data && 'redirect_url' in data) {
        window.location.href = data.redirect_url
        return
      }
      setDetails(data as OAuthAuthorizationDetails)
    })()
    return () => {
      active = false
    }
  }, [authLoading, session, authorizationId])

  async function decide(approve: boolean) {
    if (!authorizationId) return
    setBusy(true)
    setError(null)
    // approve/deny redirigent automatiquement le navigateur vers le client.
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId)
    if (error) {
      setBusy(false)
      setError("Impossible d'enregistrer votre choix. Réessayez.")
      return
    }
    // Filet de sécurité si la redirection automatique n'a pas eu lieu.
    if (data && 'redirect_url' in data) window.location.href = data.redirect_url
  }

  // --- Garde-fous -----------------------------------------------------------
  if (!authorizationId) {
    return (
      <Shell>
        <p style={{ color: 'var(--error)', fontWeight: 600 }}>
          Lien d'autorisation incomplet (paramètre <code>authorization_id</code> manquant).
        </p>
      </Shell>
    )
  }

  if (authLoading) return <FullScreenLoader label="myFridge" />

  // Non connecté : login en place, on revient ici (URL inchangée) après succès.
  if (!session) return <ConsentLogin />

  if (error) {
    return (
      <Shell>
        <p style={{ color: 'var(--error)', fontWeight: 600 }}>{error}</p>
      </Shell>
    )
  }

  if (!details) return <FullScreenLoader label="Chargement de la demande…" />

  const scopes = (details.scope || '').split(/\s+/).filter(Boolean)

  return (
    <Shell>
      <div className="col" style={{ alignItems: 'flex-start', gap: 16, padding: '24px 8px 8px' }}>
        <LogoTile />
        <div>
          <h1 className="t-display" style={{ margin: 0, color: 'var(--primary)' }}>Autoriser l'accès</h1>
          <p className="t-body-l t-muted" style={{ margin: '4px 0 0' }}>
            <strong>{details.client.name}</strong> souhaite accéder à votre compte myFridge.
          </p>
        </div>
      </div>

      <div
        className="col gap-12"
        style={{ background: 'var(--surface-2, #f3f4f6)', borderRadius: 16, padding: 16, margin: '8px 0 4px' }}
      >
        <span className="t-body-m t-muted">Connecté en tant que {details.user.email}</span>
        <span className="t-title-m" style={{ fontWeight: 700 }}>Cette application pourra :</span>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {scopes.map((s) => (
            <li key={s} className="t-body-m" style={{ margin: '4px 0' }}>
              {SCOPE_LABELS[s] ?? s}
            </li>
          ))}
          <li className="t-body-m" style={{ margin: '4px 0' }}>
            Consulter et gérer vos recettes, votre garde-manger et votre liste de courses
          </li>
        </ul>
      </div>

      <p className="t-body-m t-muted" style={{ margin: '8px 0 16px' }}>
        En autorisant, vous permettez à {details.client.name} d'agir en votre nom sur vos données myFridge.
        Vous pourrez révoquer cet accès à tout moment depuis vos paramètres.
      </p>

      <div className="col gap-12">
        <button className="btn btn--filled btn--block" disabled={busy} onClick={() => decide(true)} type="button">
          {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Autoriser'}
        </button>
        <button className="btn btn--outlined btn--block" disabled={busy} onClick={() => decide(false)} type="button">
          Refuser
        </button>
      </div>
    </Shell>
  )
}

// Coque commune (même gabarit que les écrans d'auth).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="screen screen--padded">{children}</div>
    </div>
  )
}

// Login en place : ne quitte pas l'URL (donc conserve authorization_id).
function ConsentLogin() {
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
    // En cas de succès, AuthContext met à jour la session -> l'écran de
    // consentement se réaffiche automatiquement (pas de navigation).
    if (error) setError('Connexion impossible. Vérifiez vos identifiants.')
  }

  return (
    <Shell>
      <div className="col" style={{ alignItems: 'flex-start', gap: 16, padding: '24px 8px 8px' }}>
        <LogoTile />
        <div>
          <h1 className="t-display" style={{ margin: 0, color: 'var(--primary)' }}>Connexion requise</h1>
          <p className="t-body-l t-muted" style={{ margin: '4px 0 0' }}>
            Connectez-vous pour autoriser l'accès à votre compte.
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

        {error && <p style={{ color: 'var(--error)', fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>{error}</p>}

        <button className="btn btn--filled btn--block" disabled={busy} type="submit">
          {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Se connecter'}
        </button>
      </form>

      {/* Retour sur cette même URL (avec authorization_id) après login social. */}
      <OAuthButtons redirectTo={window.location.href} />
    </Shell>
  )
}

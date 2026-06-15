import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { LogoTile } from '../components/common'
import BottomNav from '../components/BottomNav'

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`switch${on ? ' switch--on' : ''}`} role="switch" aria-checked={on} onClick={onClick}>
      <span className="switch__knob" />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { show } = useToast()
  const [fullName, setFullName] = useState('')
  const [camera, setCamera] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setCamera(profile.camera_granted)
      setNotifications(profile.notifications_granted)
    }
  }, [profile])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    show('Profil mis à jour')
  }

  async function toggleCamera() {
    const next = !camera
    setCamera(next)
    if (next) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true })
        s.getTracks().forEach((t) => t.stop())
      } catch {
        setCamera(false)
        show('Permission caméra refusée par le navigateur')
        return
      }
    }
    await supabase.from('profiles').update({ camera_granted: next }).eq('id', user!.id)
    await refreshProfile()
  }

  async function toggleNotifications() {
    const next = !notifications
    if (next && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        show('Notifications refusées par le navigateur')
        return
      }
    }
    setNotifications(next)
    await supabase.from('profiles').update({ notifications_granted: next }).eq('id', user!.id)
    await refreshProfile()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleDelete() {
    const { error } = await supabase.functions.invoke('delete-account')
    if (error) {
      show('Suppression impossible. Réessayez.')
      return
    }
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="t-headline" style={{ fontSize: 24, fontWeight: 800 }}>Profil</span>
      </header>

      <div className="screen" style={{ padding: '0 16px 110px' }}>
        {/* Identity card */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="row gap-14" style={{ marginBottom: 16 }}>
            <LogoTile size={48} />
            <div className="col">
              <span className="t-title-l">{profile?.full_name || 'Mon compte'}</span>
              <span className="t-body-m">{profile?.email}</span>
            </div>
          </div>
          <div className="field field--filled">
            <input className="field__input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <label className="field__label">Nom</label>
          </div>
          <div className="field">
            <input className="field__input" value={profile?.email ?? ''} disabled style={{ color: 'var(--muted)' }} />
            <label className="field__label field--filled">Email</label>
          </div>
          <button className="btn btn--tonal btn--block" onClick={saveProfile} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Enregistrer'}
          </button>
        </div>

        {/* Permissions */}
        <div className="t-section" style={{ margin: '0 6px 12px' }}>Autorisations</div>
        <div className="card" style={{ padding: 6, marginBottom: 20 }}>
          <div className="row" style={{ padding: '14px', justifyContent: 'space-between' }}>
            <div className="row gap-12">
              <span style={{ fontSize: 20 }}>📷</span>
              <span className="t-title-m">Caméra</span>
            </div>
            <Switch on={camera} onClick={toggleCamera} />
          </div>
          <div className="divider" style={{ margin: '0 14px' }} />
          <div className="row" style={{ padding: '14px', justifyContent: 'space-between' }}>
            <div className="row gap-12">
              <span style={{ fontSize: 20 }}>🔔</span>
              <span className="t-title-m">Notifications</span>
            </div>
            <Switch on={notifications} onClick={toggleNotifications} />
          </div>
        </div>

        {/* Account actions */}
        <div className="t-section" style={{ margin: '0 6px 12px' }}>Compte</div>
        <div className="col gap-12">
          <button className="btn btn--outlined btn--block" onClick={handleSignOut}>
            Se déconnecter
          </button>

          {!confirmDelete ? (
            <button className="btn btn--danger-text btn--block" onClick={() => setConfirmDelete(true)}>
              Supprimer mon compte
            </button>
          ) : (
            <div className="card" style={{ padding: 16, border: '1.5px solid var(--error-container)' }}>
              <p className="t-body-m" style={{ margin: '0 0 14px', color: 'var(--on-surface)' }}>
                Cette action efface définitivement votre compte, vos listes, recettes et historiques de scans.
              </p>
              <div className="col gap-12">
                <button className="btn btn--danger btn--block" onClick={handleDelete}>
                  Oui, tout supprimer
                </button>
                <button className="btn btn--text btn--block" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="t-mono t-muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 28 }}>
          myFridge · v1 · thème clair
        </p>
      </div>

      <BottomNav />
    </div>
  )
}

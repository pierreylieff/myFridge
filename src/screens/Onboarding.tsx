import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LogoTile } from '../components/common'

const STEPS = 3

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [cameraGranted, setCameraGranted] = useState(false)
  const [pantryName, setPantryName] = useState('Mon garde-manger')
  const [busy, setBusy] = useState(false)

  async function askCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCameraGranted(true)
    } catch {
      setCameraGranted(false)
    } finally {
      setStep(2)
    }
  }

  async function finish() {
    if (!user) return
    setBusy(true)
    await supabase.from('pantries').insert({ user_id: user.id, name: pantryName.trim() || 'Mon garde-manger' })
    await supabase
      .from('profiles')
      .update({ onboarding_done: true, camera_granted: cameraGranted })
      .eq('id', user.id)
    await refreshProfile()
    setBusy(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <div className="screen screen--padded col" style={{ justifyContent: 'space-between' }}>
        <div>
          {/* Progress */}
          <div className="row gap-8" style={{ padding: '32px 0 28px' }}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <div key={i} className="progress grow">
                <div className="progress__bar" style={{ width: i <= step ? '100%' : '0%' }} />
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="col" style={{ gap: 20, alignItems: 'flex-start' }}>
              <LogoTile size={64} />
              <h1 className="t-display" style={{ margin: 0, color: 'var(--primary)' }}>
                Vos courses, prêtes sans y penser
              </h1>
              <p className="t-body-l t-muted" style={{ margin: 0 }}>
                myFridge construit votre liste à partir de photos de votre frigo et de vos placards. L'IA propose,
                vous validez — rien n'est ajouté sans votre accord.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="col" style={{ gap: 20, alignItems: 'flex-start' }}>
              <div className="center" style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--primary-container)', fontSize: 32 }}>📷</div>
              <h1 className="t-headline" style={{ margin: 0 }}>Autoriser la caméra</h1>
              <p className="t-body-l t-muted" style={{ margin: 0 }}>
                La caméra sert uniquement à analyser vos photos (détection des produits). Les images sont
                supprimées après traitement. Vous pouvez aussi importer depuis la galerie.
              </p>
              {cameraGranted && (
                <span className="badge" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
                  <span className="badge__dot" style={{ background: 'var(--primary)' }} /> Caméra autorisée
                </span>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="col" style={{ gap: 20, alignItems: 'flex-start' }}>
              <div className="center" style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--tertiary-container)', fontSize: 32 }}>🧺</div>
              <h1 className="t-headline" style={{ margin: 0 }}>Votre premier garde-manger</h1>
              <p className="t-body-l t-muted" style={{ margin: 0 }}>
                Donnez-lui un nom. Il regroupera l'inventaire qui alimente votre liste de courses.
              </p>
              <div className="field field--filled" style={{ width: '100%' }}>
                <input
                  className="field__input"
                  value={pantryName}
                  onChange={(e) => setPantryName(e.target.value)}
                  placeholder="Mon garde-manger"
                />
                <label className="field__label">Nom du garde-manger</label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="col gap-12" style={{ paddingTop: 24 }}>
          {step === 0 && (
            <button className="btn btn--filled btn--block" onClick={() => setStep(1)}>
              Commencer
            </button>
          )}
          {step === 1 && (
            <>
              <button className="btn btn--filled btn--block" onClick={askCamera}>
                Autoriser la caméra
              </button>
              <button className="btn btn--text btn--block" onClick={() => setStep(2)}>
                Passer cette étape
              </button>
            </>
          )}
          {step === 2 && (
            <button className="btn btn--filled btn--block" onClick={finish} disabled={busy}>
              {busy ? <span className="spinner" style={{ borderColor: '#ffffff66', borderTopColor: '#fff' }} /> : 'Terminer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

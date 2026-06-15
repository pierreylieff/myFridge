import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { invokeFunction } from '../lib/functions'
import { useToast } from '../contexts/ToastContext'
import type { DetectedProduct, ScanType } from '../lib/types'

type Phase = 'capture' | 'preview' | 'analyzing'

export default function Scanner() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [type, setType] = useState<ScanType>('frigo')
  const [phase, setPhase] = useState<Phase>('capture')
  const [imageData, setImageData] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      setImageData(reader.result as string)
      setPhase('preview')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function analyze() {
    if (!imageData) return
    setPhase('analyzing')
    const { data, code } = await invokeFunction<{ products: DetectedProduct[] }>('analyze-scan', {
      type,
      imageBase64: imageData,
      mediaType,
    })

    if (code) {
      if (code === 'missing_api_key') show('Clé Claude non configurée côté serveur (voir README).')
      else show("L'analyse a échoué. Réessayez.")
      setPhase('preview')
      return
    }

    const products = (data?.products ?? []) as DetectedProduct[]
    // Persist scan results (image not stored — RGPD).
    const { data: userRes } = await supabase.auth.getUser()
    if (userRes.user) {
      await supabase.from('scans').insert({ user_id: userRes.user.id, type, results: products })
    }
    navigate('/scan/results', { state: { products, type }, replace: true })
  }

  const TYPE_LABELS: Record<ScanType, { label: string; emoji: string }> = {
    frigo: { label: 'Frigo', emoji: '🧊' },
    armoire: { label: 'Placards', emoji: '🗄️' },
    congelateur: { label: 'Congélateur', emoji: '❄️' },
    ticket: { label: 'Ticket', emoji: '🧾' },
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="Retour" onClick={() => navigate(-1)}>←</button>
        <span className="t-title-l">Scanner</span>
        <span style={{ width: 40 }} />
      </header>

      <div className="screen screen--padded col" style={{ justifyContent: 'space-between' }}>
        <div>
          {/* Type selector */}
          <div className="row gap-8" style={{ marginBottom: 20 }}>
            {(Object.keys(TYPE_LABELS) as ScanType[]).map((t) => (
              <button
                key={t}
                className={`chip${type === t ? ' chip--selected' : ''}`}
                onClick={() => setType(t)}
                disabled={phase === 'analyzing'}
              >
                {TYPE_LABELS[t].emoji} {TYPE_LABELS[t].label}
              </button>
            ))}
          </div>

          {/* Viewport */}
          <div
            className="center"
            style={{
              aspectRatio: '3 / 4',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              background: imageData ? '#000' : 'var(--surface-container)',
              border: imageData ? 'none' : '2px dashed var(--outline)',
              position: 'relative',
            }}
          >
            {imageData ? (
              <img src={imageData} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="center col" style={{ gap: 12, color: 'var(--muted)', padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 48 }}>📷</span>
                <span className="t-body-m">
                  Photographiez {type === 'ticket'
                    ? 'votre ticket de caisse'
                    : `l'intérieur de votre ${type === 'armoire' ? 'placard' : type === 'congelateur' ? 'congélateur' : 'frigo'}`}.
                </span>
                <span className="t-body-m" style={{ fontSize: 12 }}>Bonne lumière, cadrage net.</span>
              </div>
            )}

            {phase === 'analyzing' && (
              <div
                className="center col"
                style={{ position: 'absolute', inset: 0, background: 'rgba(14,18,15,.72)', color: '#fff', gap: 14 }}
              >
                <span className="spinner spinner--lg" />
                <span style={{ fontWeight: 600 }}>Analyse de la photo en cours…</span>
                <span className="t-body-m" style={{ color: '#cfe8d8' }}>Moins de 10 secondes</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="col gap-12" style={{ paddingTop: 24 }}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

          {phase !== 'analyzing' && !imageData && (
            <>
              <button className="btn btn--filled btn--block" onClick={() => cameraRef.current?.click()}>
                <span style={{ fontSize: 18 }}>📷</span> Prendre une photo
              </button>
              <button className="btn btn--outlined btn--block" onClick={() => galleryRef.current?.click()}>
                Importer depuis la galerie
              </button>
            </>
          )}

          {phase === 'preview' && imageData && (
            <>
              <button className="btn btn--filled btn--block" onClick={analyze}>
                Analyser la photo
              </button>
              <button
                className="btn btn--text btn--block"
                onClick={() => {
                  setImageData(null)
                  setPhase('capture')
                }}
              >
                Reprendre la photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

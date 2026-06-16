import type { Rayon } from './types'

// Rayon taxonomy + visual identity (from the myFridge design system, section 03).
export const RAYONS: Record<Rayon, { label: string; emoji: string; text: string; container: string }> = {
  frais: { label: 'Frais', emoji: '🥗', text: '#1F8A5B', container: '#C6F0D5' },
  epicerie: { label: 'Épicerie', emoji: '🥫', text: '#8A5A1F', container: '#F3E2C6' },
  surgeles: { label: 'Surgelés', emoji: '🧊', text: '#1F5E8A', container: '#C9E3F7' },
  boissons: { label: 'Boissons', emoji: '🧃', text: '#1F7A7A', container: '#C2EEEE' },
  hygiene: { label: 'Hygiène', emoji: '🧼', text: '#6A3A8A', container: '#E9D4F5' },
  autre: { label: 'Autre', emoji: '📦', text: '#5A5F5A', container: '#DDE3DD' },
}

// Fixed display order used for grouping the shopping list.
export const RAYON_ORDER: Rayon[] = ['frais', 'epicerie', 'surgeles', 'boissons', 'hygiene', 'autre']

// Emplacement physique associé à un rayon, pour la vue Stock (« ce que je devrais
// avoir dans mes armoires/frigo/congélateur »). null = pas d'emplacement dédié.
export const RAYON_LOCATION: Record<Rayon, string | null> = {
  frais: 'Frigo',
  epicerie: 'Placard',
  surgeles: 'Congélateur',
  boissons: null,
  hygiene: null,
  autre: null,
}

// Normalised units (PRD règle métier "Gestion des quantités").
export const UNITS = ['piece', 'g', 'kg', 'mL', 'L'] as const
export type Unit = (typeof UNITS)[number]

// AI confidence threshold: below this a detection is shown but NOT pre-checked.
export const CONFIDENCE_THRESHOLD = 0.7

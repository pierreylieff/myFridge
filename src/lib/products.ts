import type { Rayon } from './types'

// Lightweight internal product reference (PRD: "référentiel produits interne").
// Powers autocomplete and default rayon assignment. Not exhaustive — unknown
// products fall back to "autre" (PRD cas limite "produit hors référentiel").
export const PRODUCT_REFERENCE: { name: string; rayon: Rayon; unit?: string }[] = [
  { name: 'Lait demi-écrémé', rayon: 'frais', unit: 'L' },
  { name: 'Yaourt nature', rayon: 'frais' },
  { name: 'Beurre doux', rayon: 'frais', unit: 'g' },
  { name: 'Œufs', rayon: 'frais' },
  { name: 'Fromage râpé', rayon: 'frais', unit: 'g' },
  { name: 'Jambon', rayon: 'frais' },
  { name: 'Tomates', rayon: 'frais' },
  { name: 'Salade', rayon: 'frais' },
  { name: 'Courgettes', rayon: 'frais' },
  { name: 'Pommes', rayon: 'frais' },
  { name: 'Bananes', rayon: 'frais' },
  { name: 'Carottes', rayon: 'frais' },
  { name: 'Poulet', rayon: 'frais', unit: 'g' },
  { name: 'Pâtes penne', rayon: 'epicerie', unit: 'g' },
  { name: 'Riz', rayon: 'epicerie', unit: 'g' },
  { name: 'Farine', rayon: 'epicerie', unit: 'g' },
  { name: 'Sucre', rayon: 'epicerie', unit: 'g' },
  { name: 'Huile d\'olive', rayon: 'epicerie', unit: 'mL' },
  { name: 'Sel', rayon: 'epicerie', unit: 'g' },
  { name: 'Café', rayon: 'epicerie', unit: 'g' },
  { name: 'Confiture', rayon: 'epicerie' },
  { name: 'Conserve de thon', rayon: 'epicerie' },
  { name: 'Sauce tomate', rayon: 'epicerie' },
  { name: 'Glace vanille', rayon: 'surgeles' },
  { name: 'Légumes surgelés', rayon: 'surgeles', unit: 'g' },
  { name: 'Pizza surgelée', rayon: 'surgeles' },
  { name: 'Eau minérale', rayon: 'boissons', unit: 'L' },
  { name: 'Jus d\'orange', rayon: 'boissons', unit: 'L' },
  { name: 'Soda', rayon: 'boissons', unit: 'L' },
  { name: 'Bière', rayon: 'boissons' },
  { name: 'Dentifrice', rayon: 'hygiene' },
  { name: 'Savon', rayon: 'hygiene' },
  { name: 'Papier toilette', rayon: 'hygiene' },
  { name: 'Lessive', rayon: 'hygiene', unit: 'L' },
  { name: 'Shampoing', rayon: 'hygiene', unit: 'mL' },
]

export function guessRayon(name: string): Rayon {
  const n = name.trim().toLowerCase()
  const hit = PRODUCT_REFERENCE.find((p) => p.name.toLowerCase() === n || n.includes(p.name.toLowerCase()))
  return hit?.rayon ?? 'autre'
}

export function searchProducts(query: string, limit = 6) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PRODUCT_REFERENCE.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit)
}

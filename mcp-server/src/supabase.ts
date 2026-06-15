import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types (alignés sur le schéma SQL de myFridge)
// ---------------------------------------------------------------------------

export type Rayon = 'frais' | 'epicerie' | 'surgeles' | 'boissons' | 'hygiene' | 'autre'
export type ItemOrigin = 'ia' | 'manuel' | 'recette'

export interface PantryItem {
  id: string
  pantry_id: string
  user_id: string
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  expiry_date: string | null
  source: string
  created_at: string
}

export interface ListItem {
  id: string
  list_id: string
  user_id: string
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  checked: boolean
  origin: ItemOrigin
  confidence: number | null
  created_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  user_id: string
  name: string
  quantity: number
  unit: string
  rayon: Rayon
}

export interface Recipe {
  id: string
  user_id: string
  title: string
  image_url: string | null
  source_url: string | null
  source: string
  steps: string[]
  favorite: boolean
  created_at: string
  recipe_ingredients?: RecipeIngredient[]
}

// ---------------------------------------------------------------------------
// Client + authentification par identifiants utilisateur
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const EMAIL = process.env.MYFRIDGE_EMAIL
const PASSWORD = process.env.MYFRIDGE_PASSWORD

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    'Configuration manquante : SUPABASE_URL et SUPABASE_ANON_KEY doivent être définis (voir .env.example).',
  )
}
if (!EMAIL || !PASSWORD) {
  throw new Error(
    'Configuration manquante : MYFRIDGE_EMAIL et MYFRIDGE_PASSWORD doivent être définis (voir .env.example).',
  )
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: false },
})

let authPromise: Promise<string> | null = null

/**
 * Authentifie le client avec les identifiants utilisateur (une seule fois,
 * mémoïsé). Une fois connecté, toutes les requêtes passent par les RLS et ne
 * voient que les données de cet utilisateur. Retourne son user_id (auth.users).
 */
export async function ensureAuth(): Promise<string> {
  if (!authPromise) {
    authPromise = (async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: EMAIL!,
        password: PASSWORD!,
      })
      if (error) {
        authPromise = null // permet de réessayer au prochain appel
        throw new Error(`Échec de connexion à Supabase : ${error.message}`)
      }
      return data.user.id
    })()
  }
  return authPromise
}

// ---------------------------------------------------------------------------
// Recettes
// ---------------------------------------------------------------------------

export async function getRecipes(opts: {
  search?: string
  favoritesOnly?: boolean
}): Promise<Recipe[]> {
  await ensureAuth()
  let query = supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .order('favorite', { ascending: false })
    .order('created_at', { ascending: false })

  if (opts.favoritesOnly) query = query.eq('favorite', true)

  const { data, error } = await query
  if (error) throw error
  let recipes = (data ?? []) as Recipe[]

  // Recherche par titre OU par nom d'ingrédient (côté client : simple et suffisant).
  if (opts.search) {
    const q = opts.search.toLowerCase()
    recipes = recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.recipe_ingredients ?? []).some((i) => i.name.toLowerCase().includes(q)),
    )
  }
  return recipes
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  await ensureAuth()
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Recipe) ?? null
}

// ---------------------------------------------------------------------------
// Garde-manger / frigo
// ---------------------------------------------------------------------------

export async function getFridge(opts: {
  rayon?: Rayon
  expiringWithinDays?: number
}): Promise<PantryItem[]> {
  await ensureAuth()
  let query = supabase
    .from('pantry_items')
    .select('*')
    .order('rayon', { ascending: true })
    .order('name', { ascending: true })

  if (opts.rayon) query = query.eq('rayon', opts.rayon)

  const { data, error } = await query
  if (error) throw error
  let items = (data ?? []) as PantryItem[]

  if (typeof opts.expiringWithinDays === 'number') {
    const limit = new Date()
    limit.setDate(limit.getDate() + opts.expiringWithinDays)
    items = items.filter(
      (i) => i.expiry_date != null && new Date(i.expiry_date) <= limit,
    )
  }
  return items
}

// ---------------------------------------------------------------------------
// Liste de courses
// ---------------------------------------------------------------------------

async function getActiveListId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function getShoppingList(opts: {
  includeChecked?: boolean
}): Promise<{ listId: string | null; items: ListItem[] }> {
  await ensureAuth()
  const listId = await getActiveListId()
  if (!listId) return { listId: null, items: [] }

  let query = supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .order('checked', { ascending: true })
    .order('created_at', { ascending: true })
  if (!opts.includeChecked) query = query.eq('checked', false)

  const { data, error } = await query
  if (error) throw error
  return { listId, items: (data ?? []) as ListItem[] }
}

export interface NewItem {
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  origin?: ItemOrigin
}

/**
 * Ajoute un article à la liste active (la crée si besoin).
 * Applique la déduplication du PRD : même nom + même unité (non coché) => quantité cumulée.
 */
export async function addShoppingItem(item: NewItem): Promise<ListItem> {
  const userId = await ensureAuth()

  let listId = await getActiveListId()
  if (!listId) {
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ user_id: userId, status: 'active' })
      .select('id')
      .single()
    if (error) throw error
    listId = data.id
  }

  const { data: dupes } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .eq('checked', false)
    .ilike('name', item.name.trim())
  const dupe = (dupes as ListItem[] | null)?.find((d) => d.unit === item.unit)

  if (dupe) {
    const { data, error } = await supabase
      .from('list_items')
      .update({ quantity: Number(dupe.quantity) + item.quantity })
      .eq('id', dupe.id)
      .select('*')
      .single()
    if (error) throw error
    return data as ListItem
  }

  const { data, error } = await supabase
    .from('list_items')
    .insert({
      list_id: listId,
      user_id: userId,
      name: item.name.trim(),
      rayon: item.rayon,
      quantity: item.quantity,
      unit: item.unit,
      origin: item.origin ?? 'manuel',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ListItem
}

/** Ajoute tous les ingrédients d'une recette à la liste de courses (US9 : ajout en 1 tap). */
export async function addRecipeToShoppingList(recipeId: string): Promise<number> {
  const recipe = await getRecipe(recipeId)
  if (!recipe) throw new Error(`Recette introuvable : ${recipeId}`)
  const ingredients = recipe.recipe_ingredients ?? []
  for (const ing of ingredients) {
    await addShoppingItem({
      name: ing.name,
      rayon: ing.rayon ?? 'autre',
      quantity: Number(ing.quantity) || 1,
      unit: ing.unit || 'piece',
      origin: 'recette',
    })
  }
  return ingredients.length
}

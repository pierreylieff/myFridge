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
// Client + résolution de l'utilisateur courant
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'Configuration manquante : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis (voir .env.example).',
  )
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let cachedUserId: string | null | undefined

/**
 * Détermine l'utilisateur à qui appartiennent les données.
 * - MYFRIDGE_USER_ID a la priorité.
 * - sinon MYFRIDGE_USER_EMAIL est résolu via la table `profiles`.
 * - sinon `null` => pas de filtre (toutes les données, tous utilisateurs confondus).
 */
export async function resolveUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId

  const byId = process.env.MYFRIDGE_USER_ID?.trim()
  if (byId) {
    cachedUserId = byId
    return cachedUserId
  }

  const email = process.env.MYFRIDGE_USER_EMAIL?.trim()
  if (email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      throw new Error(`Aucun profil trouvé pour l'email "${email}".`)
    }
    cachedUserId = data.id
    return cachedUserId
  }

  cachedUserId = null
  return null
}

/** Applique le filtre user_id si un utilisateur est configuré. */
function scoped<T>(query: T, userId: string | null): T {
  // @ts-expect-error - les query builders supabase exposent .eq de façon chaînée
  return userId ? query.eq('user_id', userId) : query
}

// ---------------------------------------------------------------------------
// Recettes
// ---------------------------------------------------------------------------

export async function getRecipes(opts: {
  search?: string
  favoritesOnly?: boolean
}): Promise<Recipe[]> {
  const userId = await resolveUserId()
  let query = supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .order('favorite', { ascending: false })
    .order('created_at', { ascending: false })

  query = scoped(query, userId)
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
  const userId = await resolveUserId()
  let query = supabase.from('recipes').select('*, recipe_ingredients(*)').eq('id', id)
  query = scoped(query, userId)
  const { data, error } = await query.maybeSingle()
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
  const userId = await resolveUserId()
  let query = supabase
    .from('pantry_items')
    .select('*')
    .order('rayon', { ascending: true })
    .order('name', { ascending: true })

  query = scoped(query, userId)
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

async function getActiveListId(userId: string | null): Promise<string | null> {
  let query = supabase
    .from('shopping_lists')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
  query = scoped(query, userId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export async function getShoppingList(opts: {
  includeChecked?: boolean
}): Promise<{ listId: string | null; items: ListItem[] }> {
  const userId = await resolveUserId()
  const listId = await getActiveListId(userId)
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
  const userId = await resolveUserId()
  if (!userId) {
    throw new Error(
      "Impossible d'ajouter un article sans utilisateur ciblé. Configure MYFRIDGE_USER_EMAIL ou MYFRIDGE_USER_ID.",
    )
  }

  let listId = await getActiveListId(userId)
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

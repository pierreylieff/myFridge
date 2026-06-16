import { supabase } from './supabase'
import type { ListItem, Rayon, ItemOrigin, Recipe, ImportedRecipe, PantryItem } from './types'

// Returns the user's active shopping list id, creating one if none exists.
export async function getOrCreateActiveList(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('shopping_lists')
    .insert({ user_id: userId, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

export async function fetchItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export interface NewItem {
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  origin?: ItemOrigin
  confidence?: number | null
}

// Deduplication (PRD règle métier): same name + same unit in the same list →
// quantities are summed rather than added twice.
export async function addItem(listId: string, userId: string, item: NewItem): Promise<ListItem> {
  const { data: dupes } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', listId)
    .eq('checked', false)
    .ilike('name', item.name.trim())

  const dupe = dupes?.find((d) => d.unit === item.unit)
  if (dupe) {
    const { data, error } = await supabase
      .from('list_items')
      .update({ quantity: Number(dupe.quantity) + item.quantity })
      .eq('id', dupe.id)
      .select('*')
      .single()
    if (error) throw error
    return data
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
      confidence: item.confidence ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateItem(id: string, patch: Partial<ListItem>): Promise<void> {
  const { error } = await supabase.from('list_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('list_items').delete().eq('id', id)
  if (error) throw error
}

// ===== Inventaire / garde-manger (stock réel + cible) =====

// Returns the user's pantry id, creating a default one if none exists.
export async function getOrCreatePantry(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('pantries')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('pantries')
    .insert({ user_id: userId, name: 'Mon garde-manger' })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

export async function fetchPantryItems(pantryId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('pantry_id', pantryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export interface NewPantryItem {
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  target_qty?: number | null
  source?: string
}

// Dedup (même règle que la liste) : nom + unité identiques dans le même
// garde-manger → les quantités sont sommées plutôt que dupliquées.
export async function addOrMergePantryItem(
  pantryId: string,
  userId: string,
  item: NewPantryItem,
): Promise<PantryItem> {
  const { data: dupes } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('pantry_id', pantryId)
    .ilike('name', item.name.trim())

  const dupe = dupes?.find((d) => d.unit === item.unit)
  if (dupe) {
    const patch: Partial<PantryItem> = { quantity: Number(dupe.quantity) + item.quantity }
    // Une cible explicite écrase l'ancienne ; sinon on conserve l'existante.
    if (item.target_qty != null) patch.target_qty = item.target_qty
    const { data, error } = await supabase
      .from('pantry_items')
      .update(patch)
      .eq('id', dupe.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({
      pantry_id: pantryId,
      user_id: userId,
      name: item.name.trim(),
      rayon: item.rayon,
      quantity: item.quantity,
      unit: item.unit,
      target_qty: item.target_qty ?? null,
      source: item.source ?? 'manuel',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updatePantryItem(id: string, patch: Partial<PantryItem>): Promise<void> {
  const { error } = await supabase.from('pantry_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_items').delete().eq('id', id)
  if (error) throw error
}

export async function setRestock(id: string, needs_restock: boolean): Promise<void> {
  await updatePantryItem(id, { needs_restock })
}

// Le déficit à racheter pour un produit : cible − réel (si une cible existe),
// sinon une unité dès que le produit est marqué « à racheter ». 0 = rien à acheter.
export function restockDeficit(item: PantryItem): number {
  if (item.target_qty != null) return Math.max(0, Number(item.target_qty) - Number(item.quantity))
  return item.needs_restock ? 1 : 0
}

// Le pont stock → courses : pousse tout produit en déficit (ou marqué à racheter)
// dans la liste active, via la dédup d'addItem. Retourne le nombre d'articles ajoutés.
export async function syncListFromInventory(userId: string): Promise<number> {
  const pantryId = await getOrCreatePantry(userId)
  const items = await fetchPantryItems(pantryId)
  const listId = await getOrCreateActiveList(userId)
  let count = 0
  for (const it of items) {
    const deficit = restockDeficit(it)
    if (deficit <= 0) continue
    await addItem(listId, userId, {
      name: it.name,
      rayon: it.rayon,
      quantity: deficit,
      unit: it.unit,
      origin: 'manuel',
    })
    count++
  }
  return count
}

// Boucle courses → stock : quand un article acheté est versé au stock, on
// fusionne la quantité dans le garde-manger et on lève l'éventuel flag « à racheter ».
export async function receiveIntoStock(
  userId: string,
  item: { name: string; rayon: Rayon; quantity: number; unit: string },
): Promise<void> {
  const pantryId = await getOrCreatePantry(userId)
  const merged = await addOrMergePantryItem(pantryId, userId, {
    name: item.name,
    rayon: item.rayon,
    quantity: item.quantity,
    unit: item.unit,
  })
  if (merged.needs_restock) await setRestock(merged.id, false)
}

// ===== Recipes (US9) =====

export async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .order('favorite', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

// Persists an imported recipe + its ingredients (US8 → US9).
export async function saveRecipe(
  userId: string,
  recipe: ImportedRecipe,
  sourceUrl: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ user_id: userId, title: recipe.title || 'Recette sans titre', source_url: sourceUrl, steps: recipe.steps ?? [] })
    .select('id')
    .single()
  if (error) throw error
  const recipeId = data.id

  if (recipe.ingredients?.length) {
    const rows = recipe.ingredients.map((i) => ({
      recipe_id: recipeId,
      user_id: userId,
      name: i.name,
      quantity: i.quantity || 1,
      unit: i.unit || 'piece',
      rayon: (i.rayon ?? 'autre') as Rayon,
    }))
    const { error: ingErr } = await supabase.from('recipe_ingredients').insert(rows)
    if (ingErr) throw ingErr
  }
  return recipeId
}

export async function toggleFavorite(id: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from('recipes').update({ favorite }).eq('id', id)
  if (error) throw error
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}

// Adds a set of ingredients to the active list (1-tap from a recipe / import).
export async function addIngredientsToList(
  userId: string,
  ingredients: { name: string; quantity: number; unit: string; rayon: Rayon }[],
): Promise<number> {
  const listId = await getOrCreateActiveList(userId)
  let count = 0
  for (const ing of ingredients) {
    await addItem(listId, userId, {
      name: ing.name,
      rayon: ing.rayon ?? 'autre',
      quantity: ing.quantity || 1,
      unit: ing.unit || 'piece',
      origin: 'recette',
    })
    count++
  }
  return count
}

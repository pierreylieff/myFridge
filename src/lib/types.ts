// Domain types for myFridge. Kept hand-written and aligned with the SQL schema.

export type Rayon = 'frais' | 'epicerie' | 'surgeles' | 'boissons' | 'hygiene' | 'autre'
export type ItemOrigin = 'ia' | 'manuel' | 'recette'
export type ScanType = 'frigo' | 'armoire' | 'congelateur' | 'ticket'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  preferences: Record<string, unknown>
  camera_granted: boolean
  notifications_granted: boolean
  onboarding_done: boolean
  created_at: string
}

export interface Pantry {
  id: string
  user_id: string
  name: string
  last_scan_at: string | null
  created_at: string
}

export interface ShoppingList {
  id: string
  user_id: string
  status: string
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

export interface DetectedProduct {
  name: string
  rayon: Rayon
  quantity: number
  unit: string
  confidence: number // 0..1
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  user_id: string
  name: string
  quantity: number
  unit: string
  rayon: Rayon
  created_at: string
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

// Shape returned by the import-recipe Edge Function (before saving).
export interface ImportedRecipe {
  title: string
  ingredients: { name: string; quantity: number; unit: string; rayon: Rayon }[]
  steps: string[]
}

// Minimal shape consumed by the typed supabase client.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> }
      pantries: { Row: Pantry; Insert: Partial<Pantry> & { user_id: string }; Update: Partial<Pantry> }
      shopping_lists: { Row: ShoppingList; Insert: Partial<ShoppingList> & { user_id: string }; Update: Partial<ShoppingList> }
      list_items: {
        Row: ListItem
        Insert: Partial<ListItem> & { list_id: string; user_id: string; name: string }
        Update: Partial<ListItem>
      }
    }
    Functions: Record<string, never>
    Enums: { rayon: Rayon; item_origin: ItemOrigin; scan_type: ScanType }
  }
}

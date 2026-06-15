import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Surfaced early in dev so a missing .env is obvious.
  console.error('Supabase env manquant : vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
}

// Untyped client; domain types from ./types are applied explicitly at call sites.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

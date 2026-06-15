import { supabase } from './supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

// Invokes an Edge Function and returns { data, code } where `code` is the
// machine error string (e.g. 'missing_api_key') whether the function answered
// 2xx with an { error } body or a non-2xx that supabase-js wraps as an error.
export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; code: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await error.context.json()
        return { data: null, code: parsed?.error ?? 'function_error' }
      } catch {
        return { data: null, code: 'function_error' }
      }
    }
    return { data: null, code: 'network_error' }
  }

  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    return { data: null, code: (data as { error: string }).error }
  }

  return { data: data as T, code: null }
}

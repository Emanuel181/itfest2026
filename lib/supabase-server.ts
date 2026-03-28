import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client authenticated as the requesting user.
 * Pass the JWT from the Authorization header so RLS policies apply correctly.
 */
export function createServerClient(token?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: { persistSession: false },
  })
}

/**
 * Extracts the Bearer token from a Request's Authorization header.
 */
export function getToken(request: Request): string | undefined {
  return request.headers.get('Authorization')?.replace('Bearer ', '') ?? undefined
}

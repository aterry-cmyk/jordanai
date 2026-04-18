import { createClient } from '@supabase/supabase-js'

// Server-side admin client (bypasses RLS, used in API routes)
export function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Client-side (browser) 
export function dbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Config helpers - store/retrieve API keys from DB
export async function getConfig(key: string): Promise<string> {
  const { data } = await db().from('app_config').select('value').eq('key', key).single()
  return data?.value || process.env[key] || ''
}

export async function setConfig(key: string, value: string) {
  await db().from('app_config').upsert({ key, value, updated_at: new Date().toISOString() })
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const { data } = await db().from('app_config').select('key, value')
  const config: Record<string, string> = {}
  for (const row of data || []) config[row.key] = row.value
  return config
}

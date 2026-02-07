import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client that syncs session to cookies.
 * Use this in all 'use client' components instead of plain createClient.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

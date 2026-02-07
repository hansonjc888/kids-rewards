import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for server-side use (API routes, server components).
 * Uses cookie-based auth to identify the logged-in parent.
 *
 * NOTE: This is for authenticated dashboard operations.
 * Bot/worker operations should continue using `supabaseAdmin` from `lib/supabase.ts`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Component — ignore
            // The middleware will handle refreshing the session
          }
        },
      },
    }
  );
}

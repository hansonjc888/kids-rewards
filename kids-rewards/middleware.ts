import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for webhook routes (bot traffic)
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }

  // Create Supabase client inline to avoid import issues
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — let requests pass through
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /dashboard/* and /api/* (except webhooks and onboarding API, already handled above)
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/onboarding'));

  // /onboarding and /api/onboarding require auth but not a parent record
  const isOnboarding = pathname === '/onboarding' || pathname.startsWith('/api/onboarding');

  if ((isProtectedRoute || isOnboarding) && !user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from /login and /signup
  if ((pathname === '/login' || pathname === '/signup') && user) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login', '/signup', '/onboarding'],
};

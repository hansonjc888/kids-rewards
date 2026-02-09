'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div style={{
            width: 48, height: 48,
            background: 'var(--accent-green)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
            boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)',
          }}>&#9733;</div>
          <h1 style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>KIDS REWARDS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sign in to manage your family dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-color)',
          borderRadius: 10,
          padding: 32,
        }} className="space-y-6">
          {error && (
            <div style={{
              background: 'rgba(255, 82, 82, 0.15)',
              border: '1px solid rgba(255, 82, 82, 0.3)',
              color: 'var(--accent-red)',
              padding: '12px 16px',
              borderRadius: 6,
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="parent@example.com"
              style={{
                width: '100%',
                borderRadius: 6,
                border: '2px solid var(--border-color)',
                padding: '10px 14px',
                background: 'var(--bg-dark)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                borderRadius: 6,
                border: '2px solid var(--border-color)',
                padding: '10px 14px',
                background: 'var(--bg-dark)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--accent-green)',
              color: '#1a1a2e',
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 6,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              boxShadow: '0 0 20px rgba(0, 230, 118, 0.2)',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

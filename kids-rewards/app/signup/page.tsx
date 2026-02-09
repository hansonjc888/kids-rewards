'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setEmailSent(true);
  }

  const inputStyle = {
    width: '100%',
    borderRadius: 6,
    border: '2px solid var(--border-color)',
    padding: '10px 14px',
    background: 'var(--bg-dark)',
    color: 'var(--text-primary)',
    fontSize: 14,
  };

  const labelStyle = {
    display: 'block' as const,
    fontSize: 12,
    fontWeight: 600 as const,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div style={{
            width: 48, height: 48,
            background: 'var(--accent-blue)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
            boxShadow: '0 0 20px rgba(0, 176, 255, 0.3)',
          }}>&#9733;</div>
          <h1 style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>KIDS REWARDS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create an account to get started</p>
        </div>

        {emailSent ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 32,
            textAlign: 'center',
          }} className="space-y-4">
            <div style={{ fontSize: 48 }}>&#9993;&#65039;</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Check your email</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              We sent a confirmation link to <strong style={{ color: 'var(--accent-green)' }}>{email}</strong>. Click the link to verify your account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 32,
          }} className="space-y-5">
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
              <label htmlFor="displayName" style={labelStyle}>Your Name</label>
              <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="e.g. Mom, Dad" style={inputStyle} />
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="parent@example.com" style={inputStyle} />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
            </div>

            <div>
              <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} />
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px',
              background: 'var(--accent-green)', color: '#1a1a2e',
              fontWeight: 700, fontSize: 14, borderRadius: 6, border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              textTransform: 'uppercase', letterSpacing: 0.5,
              boxShadow: '0 0 20px rgba(0, 230, 118, 0.2)',
            }}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>

            <p className="text-center" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

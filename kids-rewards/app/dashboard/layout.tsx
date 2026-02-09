'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface ParentProfile {
  display_name: string;
  household_name: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '&#9776;' },
  { href: '/dashboard/submissions', label: 'Submissions', icon: '&#128203;' },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: '&#127942;' },
  { href: '/dashboard/settings', label: 'Settings', icon: '&#9881;' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/me')
      .then(res => {
        if (res.status === 404) {
          router.push('/onboarding');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data?.display_name) {
          setParent(data);
        }
      })
      .catch(() => {});
  }, [router]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-dark)' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0f3460, #16213e)',
        borderBottom: '3px solid var(--accent-green)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent-green)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)',
            animation: 'logoPulse 4s ease-in-out infinite',
          }}>&#9733;</div>
          <span style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
            color: 'var(--text-primary)',
          }}>KIDS REWARDS</span>
        </div>
        <div className="flex items-center gap-4">
          {parent && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {parent.display_name} &middot; {parent.household_name}
            </span>
          )}
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "'Rubik', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '2px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-red)';
              e.currentTarget.style.color = 'var(--accent-red)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        background: 'var(--bg-card)',
        borderBottom: '2px solid var(--border-color)',
        padding: '0 24px',
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
      }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontFamily: "'Rubik', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '14px 20px',
                borderBottom: `3px solid ${isActive ? 'var(--accent-green)' : 'transparent'}`,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {children}
      </main>
    </div>
  );
}

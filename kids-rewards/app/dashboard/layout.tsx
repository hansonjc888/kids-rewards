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
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/submissions', label: 'Submissions' },
  { href: '/dashboard/leaderboard', label: 'Leaderboard' },
  { href: '/dashboard/settings', label: 'Settings' },
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Kids Rewards Dashboard</h1>
          <div className="flex items-center space-x-4">
            {parent && (
              <span className="text-sm text-gray-600">
                {parent.display_name} ({parent.household_name})
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-300 hover:border-gray-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b-2 py-4 px-1 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

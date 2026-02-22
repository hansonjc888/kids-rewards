'use client';

import { useEffect, useState } from 'react';

interface Kid {
  id: string;
  display_name: string;
  username: string;
  total_stars: number;
  submission_count: number;
  approved_count: number;
}

interface Stats {
  categoryBreakdown: Record<string, number>;
}

export default function LeaderboardPage() {
  const [kids, setKids] = useState<Kid[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [kidsRes, statsRes] = await Promise.all([
        fetch('/api/kids'),
        fetch('/api/stats')
      ]);

      const kidsData = await kidsRes.json();
      const statsData = await statsRes.json();

      kidsData.sort((a: Kid, b: Kid) => b.total_stars - a.total_stars);

      setKids(kidsData);
      setStats(statsData);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  const maxStars = kids[0]?.total_stars || 1;

  const rankStyles: Record<number, { border: string; rankBg: string; rankColor: string }> = {
    1: { border: 'var(--accent-yellow)', rankBg: 'rgba(255, 214, 0, 0.2)', rankColor: 'var(--accent-yellow)' },
    2: { border: '#b0bec5', rankBg: 'rgba(176, 190, 197, 0.2)', rankColor: '#b0bec5' },
    3: { border: 'var(--accent-orange)', rankBg: 'rgba(255, 145, 0, 0.2)', rankColor: 'var(--accent-orange)' },
  };

  return (
    <div>
      {/* Leaderboard */}
      <div className="animate-fade-in delay-1" style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
        borderRadius: 10,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '2px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-yellow)', boxShadow: '0 0 8px var(--accent-yellow)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Leaderboard
          </span>
        </div>
        <div style={{ padding: 20 }}>
          {kids.map((kid, index) => {
            const rank = index + 1;
            const rs = rankStyles[rank] || { border: 'var(--border-color)', rankBg: 'rgba(255,255,255,0.05)', rankColor: 'var(--text-secondary)' };
            const barPercent = (kid.total_stars / maxStars) * 100;

            return (
              <div key={kid.id} className="flex items-center gap-4" style={{
                padding: '12px 16px',
                background: 'var(--bg-dark)',
                border: `2px solid ${rs.border}`,
                borderRadius: 8,
                marginBottom: 10,
                transition: 'all 0.2s',
                boxShadow: rank === 1 ? '0 0 20px rgba(255, 214, 0, 0.15)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700,
                  background: rs.rankBg, color: rs.rankColor, flexShrink: 0,
                }}>
                  #{rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{kid.display_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{kid.username}</div>
                </div>

                {/* Stats columns */}
                <div className="hidden md:flex items-center gap-6">
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>{kid.approved_count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Approved</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>{kid.submission_count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subs</div>
                  </div>
                </div>

                {/* Bar */}
                <div className="hidden md:block" style={{ width: 120, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg, var(--accent-yellow), var(--accent-orange))',
                    width: `${barPercent}%`,
                  }} />
                </div>

                <div style={{
                  fontFamily: "'Silkscreen', monospace", fontSize: 16, fontWeight: 700,
                  color: 'var(--accent-yellow)', minWidth: 60, textAlign: 'right',
                }}>
                  {kid.total_stars} &#x2B50;
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      {stats?.categoryBreakdown && (
        <div className="animate-fade-in delay-2" style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border-color)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '2px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-purple)', boxShadow: '0 0 8px var(--accent-purple)', display: 'inline-block' }} />
            <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Categories
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style={{ padding: 20 }}>
            {Object.entries(stats.categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <div key={category} className="flex items-center justify-between" style={{
                  background: 'var(--bg-dark)',
                  border: '2px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{category}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-blue)' }}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

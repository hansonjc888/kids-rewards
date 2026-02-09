'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  today: { submissions: number; stars: number };
  total: { submissions: number; stars: number };
  pending: number;
  categoryBreakdown: Record<string, number>;
}

interface Kid {
  id: string;
  display_name: string;
  username: string;
  total_stars: number;
  submission_count: number;
  approved_count: number;
}

interface Submission {
  id: string;
  llm_summary: string;
  llm_story: string;
  category: string;
  status: string;
  created_at: string;
  image_url?: string;
  kids: { display_name: string; username: string };
  approvals: Array<{ stars: number }>;
}

const statCards = [
  { key: 'todaySubs', label: 'Today\'s Submissions', icon: '\u{1F4DD}', color: 'green' },
  { key: 'todayStars', label: 'Today\'s Stars', icon: '\u2B50', color: 'yellow' },
  { key: 'totalStars', label: 'Total Stars', icon: '\u2705', color: 'blue' },
  { key: 'pending', label: 'Pending', icon: '\u23F3', color: 'red' },
] as const;

const colorMap: Record<string, { accent: string; bg: string; glow: string }> = {
  green: { accent: 'var(--accent-green)', bg: 'rgba(0, 230, 118, 0.15)', glow: '0 0 20px rgba(0, 230, 118, 0.3)' },
  yellow: { accent: 'var(--accent-yellow)', bg: 'rgba(255, 214, 0, 0.15)', glow: '0 0 20px rgba(255, 214, 0, 0.3)' },
  blue: { accent: 'var(--accent-blue)', bg: 'rgba(0, 176, 255, 0.15)', glow: '0 0 20px rgba(0, 176, 255, 0.3)' },
  red: { accent: 'var(--accent-red)', bg: 'rgba(255, 82, 82, 0.15)', glow: '0 0 20px rgba(255, 82, 82, 0.3)' },
};

const avatarColors = [
  'linear-gradient(135deg, #00b0ff, #0091ea)',
  'linear-gradient(135deg, #ff5252, #d50000)',
  'linear-gradient(135deg, #b388ff, #7c4dff)',
  'linear-gradient(135deg, #ff9100, #ff6d00)',
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [kids, setKids] = useState<Kid[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, kidsRes, submissionsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/kids'),
          fetch('/api/submissions?limit=10')
        ]);

        const statsData = await statsRes.json();
        const kidsData = await kidsRes.json();
        const submissionsData = await submissionsRes.json();

        setStats(statsData);
        setKids(kidsData);
        setRecentSubmissions(submissionsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const statValues: Record<string, number> = {
    todaySubs: stats?.today.submissions || 0,
    todayStars: stats?.today.stars || 0,
    totalStars: stats?.total.stars || 0,
    pending: stats?.pending || 0,
  };

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {statCards.map((card, i) => {
          const c = colorMap[card.color];
          return (
            <div key={card.key} className={`animate-fade-in delay-${i + 1}`} style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--border-color)',
              borderRadius: 10,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s',
              borderTop: `3px solid ${c.accent}`,
              cursor: 'default',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, background: c.bg, flexShrink: 0,
              }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.accent, lineHeight: 1 }}>
                  {statValues[card.key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kids Overview */}
      <div className="animate-fade-in delay-3" style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
        borderRadius: 10,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '2px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-blue)', boxShadow: '0 0 8px var(--accent-blue)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Players
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ padding: 20 }}>
          {kids.map((kid, i) => {
            const xpLevel = Math.floor(kid.total_stars / 30) + 1;
            const xpInLevel = kid.total_stars % 30;
            const xpNeeded = 30;
            const xpPercent = (xpInLevel / xpNeeded) * 100;

            return (
              <Link key={kid.id} href={`/dashboard/kids/${kid.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: 'var(--bg-dark)',
                  border: '2px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{
                      width: 44, height: 44, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, fontWeight: 800, color: 'white',
                      background: avatarColors[i % avatarColors.length],
                    }}>
                      {kid.display_name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{kid.display_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{kid.username}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: kid.total_stars, lbl: 'Stars', color: 'var(--accent-yellow)' },
                      { val: kid.submission_count, lbl: 'Subs', color: 'var(--accent-blue)' },
                      { val: kid.approved_count, lbl: 'Done', color: 'var(--accent-green)' },
                    ].map(s => (
                      <div key={s.lbl} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* XP Bar */}
                  <div style={{ marginTop: 14 }}>
                    <div className="flex justify-between" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      <span>Level {xpLevel}</span>
                      <span>{xpInLevel} / {xpNeeded} XP</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))',
                        width: `${xpPercent}%`,
                        transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="animate-fade-in delay-4" style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '2px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)', display: 'inline-block' }} />
            <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Recent Submissions
            </span>
          </div>
          <Link href="/dashboard/submissions" style={{
            fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)',
            textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            View All &rarr;
          </Link>
        </div>

        {recentSubmissions.map((submission) => {
          if (!submission.kids) return null;

          const statusConfig = submission.status === 'approved'
            ? { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)', border: 'rgba(0, 230, 118, 0.3)', label: 'Approved' }
            : submission.status === 'rejected'
            ? { bg: 'rgba(255, 82, 82, 0.15)', color: 'var(--accent-red)', border: 'rgba(255, 82, 82, 0.3)', label: 'Rejected' }
            : { bg: 'rgba(255, 214, 0, 0.15)', color: 'var(--accent-yellow)', border: 'rgba(255, 214, 0, 0.3)', label: 'Pending' };

          const categoryIcons: Record<string, string> = {
            Reading: '\u{1F4D6}', Chores: '\u{1F9F9}', Music: '\u{1F3B9}',
            Homework: '\u{1F9EE}', Art: '\u{1F3A8}', Exercise: '\u{1F3C3}',
            Cooking: '\u{1F373}', Science: '\u{1F52C}',
          };
          const icon = categoryIcons[submission.category] || '\u{1F4DD}';

          return (
            <div key={submission.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              transition: 'background 0.15s',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, overflow: 'hidden',
              }}>
                {submission.image_url ? (
                  <img src={submission.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {submission.kids.display_name}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    background: statusConfig.bg, color: statusConfig.color,
                    border: `1px solid ${statusConfig.border}`,
                  }}>
                    {statusConfig.label}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                  {submission.llm_summary}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                  {submission.llm_story}
                </div>
                <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                    {submission.category}
                  </span>
                  {submission.approvals?.[0]?.stars && (
                    <span style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>
                      {submission.approvals[0].stars} &#x2B50;
                    </span>
                  )}
                  <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

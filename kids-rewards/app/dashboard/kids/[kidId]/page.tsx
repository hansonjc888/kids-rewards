'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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

interface Redemption {
  id: string;
  reward_name: string;
  star_cost: number;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface LedgerEntry {
  id: string;
  delta_points: number;
  reason: string;
  created_at: string;
}

const statCards = [
  { key: 'stars', label: 'Total Stars', icon: '\u2B50', color: 'yellow' },
  { key: 'subs', label: 'Submissions', icon: '\u{1F4DD}', color: 'blue' },
  { key: 'approved', label: 'Approved', icon: '\u2705', color: 'green' },
  { key: 'pending', label: 'Pending', icon: '\u23F3', color: 'red' },
] as const;

const colorMap: Record<string, { accent: string; bg: string }> = {
  yellow: { accent: 'var(--accent-yellow)', bg: 'rgba(255, 214, 0, 0.15)' },
  blue: { accent: 'var(--accent-blue)', bg: 'rgba(0, 176, 255, 0.15)' },
  green: { accent: 'var(--accent-green)', bg: 'rgba(0, 230, 118, 0.15)' },
  red: { accent: 'var(--accent-red)', bg: 'rgba(255, 82, 82, 0.15)' },
};

export default function KidProfilePage() {
  const params = useParams();
  const kidId = params.kidId as string;

  const [kid, setKid] = useState<Kid | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kidsRes, submissionsRes, redemptionsRes, ledgerRes] = await Promise.all([
          fetch('/api/kids'),
          fetch(`/api/submissions?kid_id=${kidId}&limit=100`),
          fetch(`/api/redemptions?kid_id=${kidId}`),
          fetch(`/api/points-ledger?kid_id=${kidId}`),
        ]);

        const kidsData: Kid[] = await kidsRes.json();
        const submissionsData = await submissionsRes.json();
        const redemptionsData = await redemptionsRes.json();
        const ledgerData = await ledgerRes.json();

        const matchedKid = kidsData.find((k) => k.id === kidId) || null;
        setKid(matchedKid);
        setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
        setRedemptions(Array.isArray(redemptionsData) ? redemptionsData : []);
        setLedger(Array.isArray(ledgerData) ? ledgerData : []);
      } catch (error) {
        console.error('Error fetching kid profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [kidId]);

  async function handleRedemptionAction(redemptionId: string, action: 'approve' | 'deny') {
    const res = await fetch('/api/redemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, redemption_id: redemptionId }),
    });
    const result = await res.json();

    if (result.success) {
      setRedemptions(prev =>
        prev.map(r => r.id === redemptionId ? { ...r, status: result.status, resolved_at: new Date().toISOString() } : r)
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!kid) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#128269;</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Kid not found</div>
          <Link href="/dashboard" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length;

  const categoryBreakdown: Record<string, number> = {};
  for (const s of submissions) {
    if (s.category) {
      categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;
    }
  }

  const statValues: Record<string, number> = {
    stars: kid.total_stars,
    subs: kid.submission_count,
    approved: kid.approved_count,
    pending: pendingCount,
  };

  return (
    <div>
      {/* Back link + Header */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-7">
        <h1 style={{ fontFamily: "'Silkscreen', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          {kid.display_name}
        </h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>@{kid.username}</span>
      </div>

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
              borderTop: `3px solid ${c.accent}`,
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

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
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
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-purple)', boxShadow: '0 0 8px var(--accent-purple)', display: 'inline-block' }} />
            <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Categories
            </span>
          </div>
          <div className="flex flex-wrap gap-2" style={{ padding: 20 }}>
            {Object.entries(categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <span key={category} style={{
                  padding: '6px 14px', borderRadius: 6,
                  fontSize: 13, fontWeight: 600,
                  background: 'rgba(0, 176, 255, 0.15)',
                  color: 'var(--accent-blue)',
                  border: '1px solid rgba(0, 176, 255, 0.3)',
                }}>
                  {category} ({count})
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <div style={{
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
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-orange)', boxShadow: '0 0 8px var(--accent-orange)', display: 'inline-block' }} />
            <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Redemptions
            </span>
          </div>
          {redemptions.map((redemption) => {
            const statusConfig = redemption.status === 'approved'
              ? { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)', border: 'rgba(0, 230, 118, 0.3)' }
              : redemption.status === 'denied'
              ? { bg: 'rgba(255, 82, 82, 0.15)', color: 'var(--accent-red)', border: 'rgba(255, 82, 82, 0.3)' }
              : { bg: 'rgba(255, 214, 0, 0.15)', color: 'var(--accent-yellow)', border: 'rgba(255, 214, 0, 0.3)' };

            return (
              <div key={redemption.id} className="flex items-center justify-between" style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{redemption.reward_name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-yellow)' }}>{redemption.star_cost} stars</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    textTransform: 'uppercase',
                    background: statusConfig.bg, color: statusConfig.color,
                    border: `1px solid ${statusConfig.border}`,
                  }}>
                    {redemption.status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {new Date(redemption.created_at).toLocaleDateString()}
                  </span>
                </div>
                {redemption.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRedemptionAction(redemption.id, 'approve')}
                      style={{
                        padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        background: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)',
                        border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRedemptionAction(redemption.id, 'deny')}
                      style={{
                        padding: '4px 12px', fontSize: 12, fontWeight: 600,
                        background: 'rgba(255, 82, 82, 0.15)', color: 'var(--accent-red)',
                        border: '1px solid rgba(255, 82, 82, 0.3)', borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Points Transaction Log */}
      <div style={{
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
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Points Log
          </span>
        </div>
        {ledger.length === 0 ? (
          <div className="text-center" style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
            No transactions yet.
          </div>
        ) : (
          ledger.map((entry) => {
            const isPositive = entry.delta_points > 0;
            return (
              <div key={entry.id} className="flex items-center justify-between" style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{entry.reason}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {isPositive ? '+' : ''}{entry.delta_points}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Submissions Feed */}
      <div style={{
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
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-blue)', boxShadow: '0 0 8px var(--accent-blue)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Submissions
          </span>
        </div>
        {submissions.length === 0 ? (
          <div className="text-center" style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>
            No submissions yet.
          </div>
        ) : (
          submissions.map((submission) => {
            const statusConfig = submission.status === 'approved'
              ? { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)', border: 'rgba(0, 230, 118, 0.3)', label: 'Approved' }
              : submission.status === 'rejected'
              ? { bg: 'rgba(255, 82, 82, 0.15)', color: 'var(--accent-red)', border: 'rgba(255, 82, 82, 0.3)', label: 'Rejected' }
              : { bg: 'rgba(255, 214, 0, 0.15)', color: 'var(--accent-yellow)', border: 'rgba(255, 214, 0, 0.3)', label: 'Pending' };

            return (
              <div key={submission.id} style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <div className="flex items-start justify-between gap-4">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase',
                        background: statusConfig.bg, color: statusConfig.color,
                        border: `1px solid ${statusConfig.border}`,
                      }}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-primary)', marginBottom: 4, fontSize: 14 }}>{submission.llm_summary}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                      {submission.llm_story}
                    </p>
                    <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>
                        {submission.category}
                      </span>
                      {submission.approvals?.[0]?.stars && (
                        <span style={{ fontWeight: 700, color: 'var(--accent-yellow)' }}>
                          {submission.approvals[0].stars} &#x2B50;
                        </span>
                      )}
                      <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {submission.image_url && (
                    <img
                      src={submission.image_url}
                      alt="Submission"
                      style={{
                        width: 64, height: 64, objectFit: 'cover',
                        borderRadius: 8, border: '2px solid var(--border-color)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

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

export default function KidProfilePage() {
  const params = useParams();
  const kidId = params.kidId as string;

  const [kid, setKid] = useState<Kid | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kidsRes, submissionsRes, redemptionsRes] = await Promise.all([
          fetch('/api/kids'),
          fetch(`/api/submissions?kid_id=${kidId}&limit=100`),
          fetch(`/api/redemptions?kid_id=${kidId}`),
        ]);

        const kidsData: Kid[] = await kidsRes.json();
        const submissionsData = await submissionsRes.json();
        const redemptionsData = await redemptionsRes.json();

        const matchedKid = kidsData.find((k) => k.id === kidId) || null;
        setKid(matchedKid);
        setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
        setRedemptions(Array.isArray(redemptionsData) ? redemptionsData : []);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-600">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!kid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-gray-600 mb-4">Kid not found</div>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length;

  // Category breakdown from submissions
  const categoryBreakdown: Record<string, number> = {};
  for (const s of submissions) {
    if (s.category) {
      categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;
    }
  }

  return (
    <div>
      {/* Back link + Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center space-x-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{kid.display_name}</h1>
        <span className="text-gray-500">@{kid.username}</span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <span className="text-2xl">⭐</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Stars</p>
              <p className="text-2xl font-bold text-gray-900">{kid.total_stars}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <span className="text-2xl">📝</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Submissions</p>
              <p className="text-2xl font-bold text-gray-900">{kid.submission_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{kid.approved_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">📊 Categories</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <span
                    key={category}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                  >
                    {category} ({count})
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Redemptions</h2>
          </div>
          <div className="divide-y">
            {redemptions.map((redemption) => {
              const statusColor =
                redemption.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : redemption.status === 'denied'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800';

              const statusEmoji =
                redemption.status === 'approved' ? '✅' : redemption.status === 'denied' ? '❌' : '⏳';

              return (
                <div key={redemption.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{redemption.reward_name}</span>
                    <span className="text-sm font-bold text-yellow-600 ml-2">{redemption.star_cost} stars</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 ${statusColor}`}>
                      {statusEmoji} {redemption.status}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">{new Date(redemption.created_at).toLocaleDateString()}</span>
                  </div>
                  {redemption.status === 'pending' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleRedemptionAction(redemption.id, 'approve')}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRedemptionAction(redemption.id, 'deny')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submissions Feed */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">📋 Submissions</h2>
        </div>
        <div className="divide-y">
          {submissions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No submissions yet.</div>
          ) : (
            submissions.map((submission) => {
              const statusColor =
                submission.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : submission.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800';

              const statusEmoji =
                submission.status === 'approved'
                  ? '✅'
                  : submission.status === 'rejected'
                  ? '❌'
                  : '⏳';

              return (
                <div key={submission.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}
                        >
                          {statusEmoji} {submission.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-1">{submission.llm_summary}</p>
                      <p className="text-sm text-gray-500 italic mb-2">{submission.llm_story}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">{submission.category}</span>
                        {submission.approvals?.[0]?.stars && (
                          <span className="font-medium text-yellow-600">
                            {submission.approvals[0].stars}⭐
                          </span>
                        )}
                        <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {submission.image_url && (
                      <img
                        src={submission.image_url}
                        alt="Submission"
                        className="w-20 h-20 object-cover rounded-lg ml-4"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

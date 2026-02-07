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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <span className="text-2xl">📝</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today's Submissions</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.today.submissions || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <span className="text-2xl">⭐</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today's Stars</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.today.stars || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Stars</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.total.stars || 0}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Kids Overview */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">👥 Kids Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {kids.map((kid) => (
                <Link key={kid.id} href={`/dashboard/kids/${kid.id}`} className="border rounded-lg p-4 hover:shadow-md transition-shadow block">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{kid.display_name}</h3>
                    <span className="text-xs text-gray-500">@{kid.username}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stars:</span>
                      <span className="font-bold text-yellow-600">{kid.total_stars}⭐</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Submissions:</span>
                      <span className="font-medium">{kid.submission_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved:</span>
                      <span className="font-medium text-green-600">{kid.approved_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">📋 Recent Submissions</h2>
            <Link
              href="/dashboard/submissions"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="divide-y">
            {recentSubmissions.map((submission) => {
              const statusColor =
                submission.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : submission.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800';

              const statusEmoji =
                submission.status === 'approved' ? '✅' : submission.status === 'rejected' ? '❌' : '⏳';

              // Skip submissions without kid data
              if (!submission.kids) return null;

              return (
                <div key={submission.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          {submission.kids.display_name}
                        </span>
                        <span className="text-xs text-gray-500">@{submission.kids.username}</span>
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
            })}
          </div>
        </div>
    </div>
  );
}

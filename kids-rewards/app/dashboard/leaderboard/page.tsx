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

      // Sort by stars
      kidsData.sort((a: Kid, b: Kid) => b.total_stars - a.total_stars);

      setKids(kidsData);
      setStats(statsData);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-600">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  const maxStars = kids[0]?.total_stars || 1;

  return (
    <div>
        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-2xl font-bold text-gray-900">🏆 Family Leaderboard</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {kids.map((kid, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const percentage = (kid.total_stars / maxStars) * 100;

                return (
                  <div
                    key={kid.id}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                      rank === 1
                        ? 'border-yellow-400 bg-yellow-50'
                        : rank === 2
                        ? 'border-gray-400 bg-gray-50'
                        : rank === 3
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    {/* Progress Background */}
                    <div
                      className={`absolute inset-y-0 left-0 transition-all ${
                        rank === 1
                          ? 'bg-yellow-200'
                          : rank === 2
                          ? 'bg-gray-200'
                          : rank === 3
                          ? 'bg-orange-200'
                          : 'bg-blue-100'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    {/* Content */}
                    <div className="relative p-6 flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-16 text-center">
                          {medal ? (
                            <span className="text-4xl">{medal}</span>
                          ) : (
                            <span className="text-3xl font-bold text-gray-400">#{rank}</span>
                          )}
                        </div>

                        {/* Kid Info */}
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{kid.display_name}</h3>
                          <p className="text-sm text-gray-600">@{kid.username}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center space-x-8">
                        <div className="text-right">
                          <p className="text-4xl font-bold text-yellow-600">{kid.total_stars}⭐</p>
                          <p className="text-sm text-gray-500">Total Stars</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-gray-700">
                            {kid.approved_count}
                          </p>
                          <p className="text-sm text-gray-500">Approved</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-semibold text-gray-700">
                            {kid.submission_count}
                          </p>
                          <p className="text-sm text-gray-500">Submissions</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {stats?.categoryBreakdown && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">📊 Category Breakdown (Last 30 Days)</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.categoryBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => (
                    <div
                      key={category}
                      className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-900">{category}</span>
                        <span className="text-2xl font-bold text-blue-600">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

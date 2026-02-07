'use client';

import { useEffect, useState } from 'react';

interface Submission {
  id: string;
  llm_summary: string;
  llm_story: string;
  category: string;
  status: string;
  created_at: string;
  image_url?: string;
  original_text: string;
  kids: { display_name: string; username: string };
  approvals: Array<{ stars: number; created_at: string }>;
}

interface Kid {
  id: string;
  display_name: string;
  username: string;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKid, setSelectedKid] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [approving, setApproving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchKids() {
      const res = await fetch('/api/kids');
      const data = await res.json();
      setKids(data);
    }
    fetchKids();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    let url = '/api/submissions?limit=100';

    if (selectedKid !== 'all') {
      url += `&kid_id=${selectedKid}`;
    }

    if (selectedStatus !== 'all') {
      url += `&status=${selectedStatus}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubmissions();
  }, [selectedKid, selectedStatus]);

  async function handleApprove(submissionId: string, stars: number) {
    setApproving(prev => ({ ...prev, [submissionId]: true }));

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, stars, action: 'approve' }),
      });

      const data = await res.json();

      if (data.success) {
        // Update local state optimistically
        setSubmissions(prev =>
          prev.map(s =>
            s.id === submissionId
              ? { ...s, status: 'approved', approvals: [{ stars, created_at: new Date().toISOString() }] }
              : s
          )
        );
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to approve submission');
    } finally {
      setApproving(prev => ({ ...prev, [submissionId]: false }));
    }
  }

  async function handleReject(submissionId: string) {
    if (!confirm('Are you sure you want to reject this submission?')) return;

    setApproving(prev => ({ ...prev, [submissionId]: true }));

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, action: 'reject' }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmissions(prev =>
          prev.map(s =>
            s.id === submissionId ? { ...s, status: 'rejected' } : s
          )
        );
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to reject submission');
    } finally {
      setApproving(prev => ({ ...prev, [submissionId]: false }));
    }
  }

  return (
    <div>
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kid</label>
              <select
                value={selectedKid}
                onChange={(e) => setSelectedKid(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              >
                <option value="all">All Kids</option>
                {kids.map((kid) => (
                  <option key={kid.id} value={kid.id}>
                    {kid.display_name} (@{kid.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              >
                <option value="all">All Status</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">
              📋 Submissions ({submissions.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">⏳</div>
              Loading submissions...
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-4">📭</div>
              No submissions found
            </div>
          ) : (
            <div className="divide-y">
              {submissions.map((submission) => {
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

                const isPending = submission.status === 'pending_review';
                const isProcessing = approving[submission.id];

                // Skip submissions without kid data
                if (!submission.kids) return null;

                return (
                  <div key={submission.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center flex-wrap gap-2 mb-3">
                          <span className="font-semibold text-gray-900 text-lg">
                            {submission.kids.display_name}
                          </span>
                          <span className="text-sm text-gray-500">@{submission.kids.username}</span>
                          <span
                            className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}
                          >
                            {statusEmoji} {submission.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Summary */}
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {submission.llm_summary}
                        </h3>

                        {/* Story */}
                        <p className="text-gray-700 mb-3 italic border-l-4 border-blue-200 pl-4 py-2 bg-blue-50">
                          {submission.llm_story}
                        </p>

                        {/* Original Text */}
                        <p className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Original:</span> "{submission.original_text}"
                        </p>

                        {/* Meta Info */}
                        <div className="flex items-center flex-wrap gap-3 text-sm">
                          <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-700">
                            {submission.category}
                          </span>
                          {submission.approvals?.[0]?.stars && (
                            <span className="font-semibold text-yellow-600 text-base">
                              {submission.approvals[0].stars}⭐
                            </span>
                          )}
                          <span className="text-gray-500">
                            {new Date(submission.created_at).toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400">ID: {submission.id.slice(0, 8)}</span>
                        </div>

                        {/* Approval Actions — only for pending submissions */}
                        {isPending && (
                          <div className="mt-4 flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-700 mr-1">Approve:</span>
                            {[1, 2, 3].map((stars) => (
                              <button
                                key={stars}
                                onClick={() => handleApprove(submission.id, stars)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 rounded-lg text-sm font-medium text-yellow-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {'⭐'.repeat(stars)} {stars}
                              </button>
                            ))}
                            <button
                              onClick={() => handleReject(submission.id)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg text-sm font-medium text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-2"
                            >
                              ❌ Reject
                            </button>
                            {isProcessing && (
                              <span className="text-sm text-gray-500 ml-2">Processing...</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Image */}
                      {submission.image_url && (
                        <div className="ml-6 flex-shrink-0">
                          <img
                            src={submission.image_url}
                            alt="Submission evidence"
                            className="w-32 h-32 object-cover rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow"
                            onClick={() => window.open(submission.image_url, '_blank')}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );
}

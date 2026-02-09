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

  const selectStyle = {
    width: '100%',
    borderRadius: 6,
    border: '2px solid var(--border-color)',
    padding: '10px 14px',
    background: 'var(--bg-dark)',
    color: 'var(--text-primary)',
    fontSize: 14,
  };

  return (
    <div>
      {/* Filters */}
      <div className="animate-fade-in delay-1" style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ fontFamily: "'Silkscreen', monospace", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kid</label>
            <select value={selectedKid} onChange={(e) => setSelectedKid(e.target.value)} style={selectStyle}>
              <option value="all">All Kids</option>
              {kids.map((kid) => (
                <option key={kid.id} value={kid.id}>{kid.display_name} (@{kid.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={selectStyle}>
              <option value="all">All Status</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions List */}
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
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Submissions ({submissions.length})
          </span>
        </div>

        {loading ? (
          <div className="text-center" style={{ padding: 48, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
            Loading submissions...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center" style={{ padding: 48, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128237;</div>
            No submissions found
          </div>
        ) : (
          submissions.map((submission) => {
            if (!submission.kids) return null;

            const statusConfig = submission.status === 'approved'
              ? { bg: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)', border: 'rgba(0, 230, 118, 0.3)', label: 'Approved' }
              : submission.status === 'rejected'
              ? { bg: 'rgba(255, 82, 82, 0.15)', color: 'var(--accent-red)', border: 'rgba(255, 82, 82, 0.3)', label: 'Rejected' }
              : { bg: 'rgba(255, 214, 0, 0.15)', color: 'var(--accent-yellow)', border: 'rgba(255, 214, 0, 0.3)', label: 'Pending' };

            const isPending = submission.status === 'pending_review';
            const isProcessing = approving[submission.id];

            return (
              <div key={submission.id} style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                transition: 'background 0.15s',
              }}>
                <div className="flex items-start justify-between gap-4">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header */}
                    <div className="flex items-center flex-wrap gap-2 mb-3">
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>
                        {submission.kids.display_name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{submission.kids.username}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: statusConfig.bg, color: statusConfig.color,
                        border: `1px solid ${statusConfig.border}`,
                      }}>
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Summary */}
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                      {submission.llm_summary}
                    </h3>

                    {/* Story */}
                    <p style={{
                      color: 'var(--text-secondary)', marginBottom: 10, fontStyle: 'italic',
                      borderLeft: '3px solid var(--accent-blue)', paddingLeft: 12, paddingTop: 4, paddingBottom: 4,
                      background: 'rgba(0, 176, 255, 0.05)', borderRadius: '0 4px 4px 0',
                      fontSize: 13, lineHeight: 1.5,
                    }}>
                      {submission.llm_story}
                    </p>

                    {/* Original Text */}
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      <span style={{ fontWeight: 600 }}>Original:</span> &ldquo;{submission.original_text}&rdquo;
                    </p>

                    {/* Meta */}
                    <div className="flex items-center flex-wrap gap-3" style={{ fontSize: 12 }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: 4,
                        fontWeight: 500, color: 'var(--text-secondary)',
                      }}>
                        {submission.category}
                      </span>
                      {submission.approvals?.[0]?.stars && (
                        <span style={{ fontWeight: 700, color: 'var(--accent-yellow)', fontSize: 14 }}>
                          {submission.approvals[0].stars} &#x2B50;
                        </span>
                      )}
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(submission.created_at).toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>
                        ID: {submission.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Approval Actions */}
                    {isPending && (
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 14 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>Approve:</span>
                        {[1, 2, 3].map((stars) => (
                          <button
                            key={stars}
                            onClick={() => handleApprove(submission.id, stars)}
                            disabled={isProcessing}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(255, 214, 0, 0.1)',
                              border: '2px solid rgba(255, 214, 0, 0.3)',
                              borderRadius: 6,
                              fontSize: 13, fontWeight: 600,
                              color: 'var(--accent-yellow)',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              opacity: isProcessing ? 0.5 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            {'&#x2B50;'.repeat(stars)} {stars}
                          </button>
                        ))}
                        <button
                          onClick={() => handleReject(submission.id)}
                          disabled={isProcessing}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(255, 82, 82, 0.1)',
                            border: '2px solid rgba(255, 82, 82, 0.3)',
                            borderRadius: 6,
                            fontSize: 13, fontWeight: 600,
                            color: 'var(--accent-red)',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isProcessing ? 0.5 : 1,
                            marginLeft: 4,
                          }}
                        >
                          Reject
                        </button>
                        {isProcessing && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>Processing...</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image */}
                  {submission.image_url && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={submission.image_url}
                        alt="Submission evidence"
                        style={{
                          width: 100, height: 100, objectFit: 'cover',
                          borderRadius: 8, border: '2px solid var(--border-color)',
                          cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onClick={() => window.open(submission.image_url, '_blank')}
                      />
                    </div>
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

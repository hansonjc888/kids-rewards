import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-2xl w-full rounded-xl p-8 md:p-12 text-center" style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--border-color)',
      }}>
        <div style={{
          width: 64, height: 64,
          background: 'var(--accent-yellow)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          margin: '0 auto 24px',
          boxShadow: '0 0 30px rgba(255, 214, 0, 0.3)',
          animation: 'logoPulse 3s ease-in-out infinite',
        }}>&#9733;</div>

        <h1 style={{
          fontFamily: "'Silkscreen', monospace",
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 12,
          letterSpacing: 1,
        }}>
          KIDS REWARDS
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 40 }}>
          Track achievements, earn stars, and celebrate success together!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div style={{
            background: 'var(--bg-dark)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 24,
            borderTop: '3px solid var(--accent-blue)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#128221;</div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submit</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Kids share achievements via Telegram</p>
          </div>
          <div style={{
            background: 'var(--bg-dark)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 24,
            borderTop: '3px solid var(--accent-green)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#9989;</div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Approve</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Parents review and award stars</p>
          </div>
          <div style={{
            background: 'var(--bg-dark)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 24,
            borderTop: '3px solid var(--accent-yellow)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#127942;</div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Track</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>View progress and leaderboard</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: 'var(--accent-green)',
            color: '#1a1a2e',
            fontFamily: "'Rubik', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            padding: '14px 32px',
            borderRadius: 8,
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: 1,
            boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)',
            transition: 'all 0.2s',
          }}
        >
          View Dashboard &rarr;
        </Link>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid var(--border-color)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Telegram Bot: @hansonjc_assistant_bot
          </p>
          <div className="flex items-center justify-center gap-4" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>AI-powered stories</span>
            <span style={{ color: 'var(--border-color)' }}>&bull;</span>
            <span>Image support</span>
            <span style={{ color: 'var(--border-color)' }}>&bull;</span>
            <span>Multilingual</span>
          </div>
        </div>
      </div>
    </div>
  );
}

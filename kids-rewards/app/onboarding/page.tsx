'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState('');
  const [kids, setKids] = useState([{ name: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function addKid() {
    setKids([...kids, { name: '' }]);
  }

  function removeKid(index: number) {
    if (kids.length <= 1) return;
    setKids(kids.filter((_, i) => i !== index));
  }

  function updateKidName(index: number, name: string) {
    const updated = [...kids];
    updated[index] = { name };
    setKids(updated);
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    if (!familyName.trim()) {
      setError('Please enter a family name');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const kidNames = kids.map(k => k.name.trim()).filter(Boolean);
    if (kidNames.length === 0) {
      setError('Please add at least one kid');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyName: familyName.trim(),
        kids: kidNames,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  const inputStyle = {
    width: '100%',
    borderRadius: 6,
    border: '2px solid var(--border-color)',
    padding: '10px 14px',
    background: 'var(--bg-dark)',
    color: 'var(--text-primary)',
    fontSize: 14,
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-dark)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 style={{
            fontFamily: "'Silkscreen', monospace",
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>Welcome!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {step === 1 ? "Let's set up your family" : 'Add your kids'}
          </p>
          <div className="flex justify-center mt-4 gap-2">
            <div style={{
              height: 6, width: 64, borderRadius: 3,
              background: step >= 1 ? 'var(--accent-green)' : 'var(--border-color)',
              boxShadow: step >= 1 ? '0 0 8px var(--accent-green)' : 'none',
            }} />
            <div style={{
              height: 6, width: 64, borderRadius: 3,
              background: step >= 2 ? 'var(--accent-green)' : 'var(--border-color)',
              boxShadow: step >= 2 ? '0 0 8px var(--accent-green)' : 'none',
            }} />
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleNextStep} style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 32,
          }} className="space-y-6">
            {error && (
              <div style={{
                background: 'rgba(255, 82, 82, 0.15)',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                color: 'var(--accent-red)',
                padding: '12px 16px',
                borderRadius: 6,
                fontSize: 14,
              }}>{error}</div>
            )}

            <div>
              <label htmlFor="familyName" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Family Name
              </label>
              <input id="familyName" type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required placeholder='e.g. "Smith Family"' style={inputStyle} />
            </div>

            <button type="submit" style={{
              width: '100%', padding: '12px',
              background: 'var(--accent-green)', color: '#1a1a2e',
              fontWeight: 700, fontSize: 14, borderRadius: 6, border: 'none',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Next
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border-color)',
            borderRadius: 10,
            padding: 32,
          }} className="space-y-6">
            {error && (
              <div style={{
                background: 'rgba(255, 82, 82, 0.15)',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                color: 'var(--accent-red)',
                padding: '12px 16px',
                borderRadius: 6,
                fontSize: 14,
              }}>{error}</div>
            )}

            <div className="space-y-3">
              {kids.map((kid, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input type="text" value={kid.name} onChange={(e) => updateKidName(index, e.target.value)} placeholder={`Kid ${index + 1} name`} style={inputStyle} />
                  {kids.length > 1 && (
                    <button type="button" onClick={() => removeKid(index)} style={{
                      padding: '8px 12px', fontSize: 13, fontWeight: 600,
                      color: 'var(--accent-red)', background: 'transparent', border: 'none', cursor: 'pointer',
                    }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={addKid} style={{
              width: '100%', padding: '10px',
              background: 'transparent', color: 'var(--text-secondary)',
              border: '2px solid var(--border-color)', borderRadius: 6,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              + Add Another Kid
            </button>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep(1); setError(''); }} style={{
                flex: 1, padding: '12px',
                background: 'transparent', color: 'var(--text-secondary)',
                border: '2px solid var(--border-color)', borderRadius: 6,
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>
                Back
              </button>
              <button type="submit" disabled={loading} style={{
                flex: 1, padding: '12px',
                background: 'var(--accent-green)', color: '#1a1a2e',
                fontWeight: 700, fontSize: 14, borderRadius: 6, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {loading ? 'Setting up...' : 'Finish Setup'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-600">
            {step === 1
              ? "Let's set up your family"
              : 'Add your kids'}
          </p>
          <div className="flex justify-center mt-4 space-x-2">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`} />
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleNextStep} className="bg-white rounded-lg shadow p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
                Family Name
              </label>
              <input
                id="familyName"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder='e.g. "Smith Family"'
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Next
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {kids.map((kid, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={kid.name}
                    onChange={(e) => updateKidName(index, e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder={`Kid ${index + 1} name`}
                  />
                  {kids.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKid(index)}
                      className="text-red-500 hover:text-red-700 px-2 py-2 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addKid}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              + Add Another Kid
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting up...' : 'Finish Setup'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Kid {
  id: string;
  display_name: string;
  username: string;
}

interface Contact {
  id: string;
  platform: string;
  platform_user_id: string;
}

interface SettingsData {
  parent: { display_name: string; email: string };
  assignedKidIds: string[];
  allKids: Kid[];
  contacts: Contact[];
  inviteCode: string | null;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [assignedKids, setAssignedKids] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // New contact form
  const [newPlatform, setNewPlatform] = useState<'telegram' | 'whatsapp'>('telegram');
  const [newPlatformUserId, setNewPlatformUserId] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(settings => {
        setData(settings);
        setDisplayName(settings.parent.display_name);
        setAssignedKids(new Set(settings.assignedKidIds));
        setInviteCode(settings.inviteCode);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function showMessage(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function saveDisplayName() {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    const result = await res.json();
    setSaving(false);
    showMessage(result.success ? 'Name updated!' : `Error: ${result.error}`);
  }

  async function saveKidAssignments() {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid_ids: Array.from(assignedKids) }),
    });
    const result = await res.json();
    setSaving(false);
    showMessage(result.success ? 'Kid assignments updated!' : `Error: ${result.error}`);
  }

  function toggleKid(kidId: string) {
    setAssignedKids(prev => {
      const next = new Set(prev);
      if (next.has(kidId)) {
        next.delete(kidId);
      } else {
        next.add(kidId);
      }
      return next;
    });
  }

  async function addContact() {
    if (!newPlatformUserId.trim()) return;

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_contact',
        platform: newPlatform,
        platform_user_id: newPlatformUserId.trim(),
      }),
    });
    const result = await res.json();

    if (result.success) {
      showMessage('Contact added!');
      setNewPlatformUserId('');
      // Refresh settings
      const settingsRes = await fetch('/api/settings');
      const settings = await settingsRes.json();
      setData(settings);
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function deleteContact(contactId: string) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_contact',
        contact_id: contactId,
      }),
    });
    const result = await res.json();

    if (result.success) {
      showMessage('Contact removed!');
      setData(prev => prev ? {
        ...prev,
        contacts: prev.contacts.filter(c => c.id !== contactId),
      } : null);
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function regenerateInviteCode() {
    setRegenerating(true);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate_invite_code' }),
    });
    const result = await res.json();
    setRegenerating(false);

    if (result.success) {
      setInviteCode(result.invite_code);
      showMessage('Invite code regenerated! Old code no longer works.');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function copyInviteCode() {
    if (inviteCode) {
      await navigator.clipboard.writeText(inviteCode);
      showMessage('Invite code copied!');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">Loading settings...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-red-600">Failed to load settings</div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          {message}
        </div>
      )}

      {/* Profile */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              value={data.parent.email}
              disabled
              className="block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="block flex-1 rounded-md border border-gray-300 px-3 py-2"
              />
              <button
                onClick={saveDisplayName}
                disabled={saving || displayName === data.parent.display_name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Family Invite Code */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Family Invite Code</h2>
        <p className="text-sm text-gray-600 mb-4">
          Share this code with your kids so they can link their Telegram chat to your family using <code className="bg-gray-100 px-1 rounded">/join {inviteCode || '...'}</code>
        </p>
        <div className="flex items-center space-x-3">
          {inviteCode ? (
            <>
              <span className="text-2xl font-mono font-bold tracking-widest bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {inviteCode}
              </span>
              <button
                onClick={copyInviteCode}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Copy
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-500 py-2">No invite code yet.</span>
          )}
          <button
            onClick={regenerateInviteCode}
            disabled={regenerating}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 text-sm"
          >
            {regenerating ? 'Generating...' : inviteCode ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Kid Assignments */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Kid Assignments</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select which kids you can see in the dashboard.
        </p>
        <div className="space-y-2 mb-4">
          {data.allKids.map(kid => (
            <label key={kid.id} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={assignedKids.has(kid.id)}
                onChange={() => toggleKid(kid.id)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <span className="text-gray-900">{kid.display_name}</span>
              <span className="text-sm text-gray-500">@{kid.username}</span>
            </label>
          ))}
        </div>
        <button
          onClick={saveKidAssignments}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          Save Assignments
        </button>
      </div>

      {/* Notification Contacts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Contacts</h2>
        <p className="text-sm text-gray-600 mb-4">
          Add your Telegram or WhatsApp ID to receive notifications when kids submit achievements.
        </p>

        {/* Existing contacts */}
        {data.contacts.length > 0 ? (
          <div className="space-y-2 mb-6">
            {data.contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900 capitalize">{contact.platform}</span>
                  <span className="text-sm text-gray-600 ml-2">{contact.platform_user_id}</span>
                </div>
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">No contacts configured yet.</p>
        )}

        {/* Add contact form */}
        <div className="flex items-end space-x-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={newPlatform}
              onChange={e => setNewPlatform(e.target.value as 'telegram' | 'whatsapp')}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">User/Chat ID</label>
            <input
              type="text"
              value={newPlatformUserId}
              onChange={e => setNewPlatformUserId(e.target.value)}
              placeholder="e.g. 123456789"
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            onClick={addContact}
            disabled={!newPlatformUserId.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Kid {
  id: string;
  display_name: string;
  username: string;
  has_pin?: boolean;
}

interface Contact {
  id: string;
  platform: string;
  platform_user_id: string;
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  star_cost: number;
  is_active: boolean;
}

interface SettingsData {
  parent: { display_name: string; email: string };
  assignedKidIds: string[];
  allKids: Kid[];
  contacts: Contact[];
  inviteCode: string | null;
  resetSchedule: string;
  lastResetAt: string | null;
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

  // Rewards catalog
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [editRewardName, setEditRewardName] = useState('');
  const [editRewardDesc, setEditRewardDesc] = useState('');
  const [editRewardCost, setEditRewardCost] = useState('');

  // Reset schedule
  const [resetSchedule, setResetSchedule] = useState('none');
  const [lastResetAt, setLastResetAt] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Kid PINs
  const [kidPins, setKidPins] = useState<Record<string, string>>({});
  const [savingPin, setSavingPin] = useState<string | null>(null);
  const [kidsList, setKidsList] = useState<Kid[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(res => res.json()),
      fetch('/api/rewards').then(res => res.json()),
      fetch('/api/kids').then(res => res.json()),
    ])
      .then(([settings, rewardsData, kidsData]) => {
        setData(settings);
        setDisplayName(settings.parent.display_name);
        setAssignedKids(new Set(settings.assignedKidIds));
        setInviteCode(settings.inviteCode);
        setResetSchedule(settings.resetSchedule || 'none');
        setLastResetAt(settings.lastResetAt);
        setRewards(Array.isArray(rewardsData) ? rewardsData : []);
        setKidsList(Array.isArray(kidsData) ? kidsData : []);
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

  // Rewards CRUD
  async function addReward() {
    const cost = parseInt(newRewardCost);
    if (!newRewardName.trim() || !cost || cost < 1) return;

    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newRewardName.trim(),
        description: newRewardDesc.trim() || null,
        star_cost: cost,
      }),
    });
    const result = await res.json();

    if (result.id) {
      setRewards(prev => [result, ...prev]);
      setNewRewardName('');
      setNewRewardDesc('');
      setNewRewardCost('');
      showMessage('Reward added!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function updateReward(id: string) {
    const cost = parseInt(editRewardCost);
    if (!editRewardName.trim() || !cost || cost < 1) return;

    const res = await fetch('/api/rewards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: editRewardName.trim(),
        description: editRewardDesc.trim() || null,
        star_cost: cost,
      }),
    });
    const result = await res.json();

    if (result.success) {
      setRewards(prev => prev.map(r => r.id === id ? { ...r, name: editRewardName.trim(), description: editRewardDesc.trim() || null, star_cost: cost } : r));
      setEditingReward(null);
      showMessage('Reward updated!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function deleteReward(id: string) {
    const res = await fetch('/api/rewards', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const result = await res.json();

    if (result.success) {
      setRewards(prev => prev.map(r => r.id === id ? { ...r, is_active: false } : r));
      showMessage('Reward deactivated!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function reactivateReward(id: string) {
    const res = await fetch('/api/rewards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: true }),
    });
    const result = await res.json();

    if (result.success) {
      setRewards(prev => prev.map(r => r.id === id ? { ...r, is_active: true } : r));
      showMessage('Reward reactivated!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  function startEditing(reward: Reward) {
    setEditingReward(reward.id);
    setEditRewardName(reward.name);
    setEditRewardDesc(reward.description || '');
    setEditRewardCost(reward.star_cost.toString());
  }

  // Reset
  async function saveResetSchedule(value: string) {
    setResetSchedule(value);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_reset_schedule', value }),
    });
    const result = await res.json();
    showMessage(result.success ? 'Reset schedule updated!' : `Error: ${result.error}`);
  }

  async function performReset() {
    setResetting(true);
    setShowResetConfirm(false);
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    const result = await res.json();
    setResetting(false);

    if (result.success) {
      setLastResetAt(new Date().toISOString());
      showMessage('Points reset successfully!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function savePin(kidId: string) {
    const pin = kidPins[kidId];
    if (!pin || !/^\d{4}$/.test(pin)) {
      showMessage('PIN must be exactly 4 digits');
      return;
    }
    setSavingPin(kidId);
    const res = await fetch('/api/kids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_pin', kid_id: kidId, pin }),
    });
    const result = await res.json();
    setSavingPin(null);
    if (result.success) {
      setKidsList(prev => prev.map(k => k.id === kidId ? { ...k, has_pin: true } : k));
      setKidPins(prev => ({ ...prev, [kidId]: '' }));
      showMessage('PIN saved!');
    } else {
      showMessage(`Error: ${result.error}`);
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

      {/* Rewards Catalog */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rewards Catalog</h2>
        <p className="text-sm text-gray-600 mb-4">
          Define rewards that kids can redeem their stars for via Telegram.
        </p>

        {/* Existing rewards */}
        {rewards.length > 0 ? (
          <div className="space-y-2 mb-6">
            {rewards.map(reward => (
              <div key={reward.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${reward.is_active ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}>
                {editingReward === reward.id ? (
                  <div className="flex items-end space-x-2 flex-1">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editRewardName}
                        onChange={e => setEditRewardName(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
                        placeholder="Reward name"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editRewardDesc}
                        onChange={e => setEditRewardDesc(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
                        placeholder="Description"
                      />
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        value={editRewardCost}
                        onChange={e => setEditRewardCost(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
                        min="1"
                      />
                    </div>
                    <button onClick={() => updateReward(reward.id)} className="text-sm text-blue-600 hover:text-blue-800">Save</button>
                    <button onClick={() => setEditingReward(null)} className="text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{reward.name}</span>
                      {reward.description && <span className="text-sm text-gray-500 ml-2">({reward.description})</span>}
                      <span className="text-sm font-bold text-yellow-600 ml-2">{reward.star_cost} stars</span>
                      {!reward.is_active && <span className="text-xs text-red-500 ml-2">(inactive)</span>}
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => startEditing(reward)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                      {reward.is_active ? (
                        <button onClick={() => deleteReward(reward.id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                      ) : (
                        <button onClick={() => reactivateReward(reward.id)} className="text-sm text-green-600 hover:text-green-800">Reactivate</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">No rewards configured yet.</p>
        )}

        {/* Add reward form */}
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={newRewardName}
              onChange={e => setNewRewardName(e.target.value)}
              placeholder="e.g. Screen Time (30 min)"
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={newRewardDesc}
              onChange={e => setNewRewardDesc(e.target.value)}
              placeholder="Optional description"
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-700 mb-1">Stars</label>
            <input
              type="number"
              value={newRewardCost}
              onChange={e => setNewRewardCost(e.target.value)}
              placeholder="5"
              min="1"
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            onClick={addReward}
            disabled={!newRewardName.trim() || !newRewardCost || parseInt(newRewardCost) < 1}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Reset Schedule */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Points Reset Schedule</h2>
        <p className="text-sm text-gray-600 mb-4">
          Automatically reset all kids&apos; star balances on a schedule to keep motivation fresh.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <select
              value={resetSchedule}
              onChange={e => saveResetSchedule(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="none">None (manual only)</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {lastResetAt && (
            <p className="text-sm text-gray-500">
              Last reset: {new Date(lastResetAt).toLocaleDateString()} {new Date(lastResetAt).toLocaleTimeString()}
            </p>
          )}

          <div>
            {showResetConfirm ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-red-600 font-medium">Are you sure? This will zero out all balances.</span>
                <button
                  onClick={performReset}
                  disabled={resetting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  {resetting ? 'Resetting...' : 'Yes, Reset Now'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
              >
                Reset Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kid Redemption PINs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Redemption PINs</h2>
        <p className="text-sm text-gray-600 mb-4">
          Set a 4-digit PIN for each kid to verify their identity when redeeming rewards via Telegram.
        </p>
        {kidsList.length > 0 ? (
          <div className="space-y-3">
            {kidsList.map(kid => (
              <div key={kid.id} className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{kid.display_name}</span>
                  <span className="text-sm text-gray-500 ml-2">@{kid.username}</span>
                  {kid.has_pin && <span className="text-xs text-green-600 ml-2">(PIN set)</span>}
                  {!kid.has_pin && <span className="text-xs text-orange-500 ml-2">(no PIN)</span>}
                </div>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={kidPins[kid.id] || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setKidPins(prev => ({ ...prev, [kid.id]: val }));
                  }}
                  className="w-28 rounded-md border border-gray-300 px-3 py-1 text-sm text-center tracking-widest"
                />
                <button
                  onClick={() => savePin(kid.id)}
                  disabled={savingPin === kid.id || !kidPins[kid.id] || kidPins[kid.id]?.length !== 4}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {savingPin === kid.id ? 'Saving...' : kid.has_pin ? 'Change' : 'Set PIN'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No kids found. Add kids to your household first.</p>
        )}
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

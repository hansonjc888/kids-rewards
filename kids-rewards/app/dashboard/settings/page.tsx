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

const panelStyle = {
  background: 'var(--bg-card)',
  border: '2px solid var(--border-color)',
  borderRadius: 10,
  padding: 24,
};

const sectionTitleStyle = {
  fontFamily: "'Silkscreen', monospace",
  fontSize: 13,
  fontWeight: 700 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  color: 'var(--text-primary)',
  marginBottom: 4,
};

const sectionDescStyle = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  marginBottom: 16,
};

const inputStyle = {
  width: '100%',
  borderRadius: 6,
  border: '2px solid var(--border-color)',
  padding: '10px 14px',
  background: 'var(--bg-dark)',
  color: 'var(--text-primary)',
  fontSize: 14,
};

const labelStyle = {
  display: 'block' as const,
  fontSize: 12,
  fontWeight: 600 as const,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

const btnPrimary = {
  padding: '8px 16px',
  background: 'var(--accent-green)',
  color: '#1a1a2e',
  fontWeight: 700 as const,
  fontSize: 13,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

const btnSecondary = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontWeight: 600 as const,
  fontSize: 13,
  borderRadius: 6,
  border: '2px solid var(--border-color)',
  cursor: 'pointer',
};

const btnDanger = {
  padding: '8px 16px',
  background: 'rgba(255, 82, 82, 0.15)',
  color: 'var(--accent-red)',
  fontWeight: 600 as const,
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid rgba(255, 82, 82, 0.3)',
  cursor: 'pointer',
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [assignedKids, setAssignedKids] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [newPlatform, setNewPlatform] = useState<'telegram' | 'whatsapp'>('telegram');
  const [newPlatformUserId, setNewPlatformUserId] = useState('');

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');
  const [editingReward, setEditingReward] = useState<string | null>(null);
  const [editRewardName, setEditRewardName] = useState('');
  const [editRewardDesc, setEditRewardDesc] = useState('');
  const [editRewardCost, setEditRewardCost] = useState('');

  const [resetSchedule, setResetSchedule] = useState('none');
  const [lastResetAt, setLastResetAt] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
      if (next.has(kidId)) next.delete(kidId);
      else next.add(kidId);
      return next;
    });
  }

  async function addContact() {
    if (!newPlatformUserId.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_contact', platform: newPlatform, platform_user_id: newPlatformUserId.trim() }),
    });
    const result = await res.json();
    if (result.success) {
      showMessage('Contact added!');
      setNewPlatformUserId('');
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
      body: JSON.stringify({ action: 'delete_contact', contact_id: contactId }),
    });
    const result = await res.json();
    if (result.success) {
      showMessage('Contact removed!');
      setData(prev => prev ? { ...prev, contacts: prev.contacts.filter(c => c.id !== contactId) } : null);
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
      showMessage('Invite code regenerated!');
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

  async function addReward() {
    const cost = parseInt(newRewardCost);
    if (!newRewardName.trim() || !cost || cost < 1) return;
    const res = await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRewardName.trim(), description: newRewardDesc.trim() || null, star_cost: cost }),
    });
    const result = await res.json();
    if (result.id) {
      setRewards(prev => [result, ...prev]);
      setNewRewardName(''); setNewRewardDesc(''); setNewRewardCost('');
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
      body: JSON.stringify({ id, name: editRewardName.trim(), description: editRewardDesc.trim() || null, star_cost: cost }),
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
    const res = await fetch('/api/rewards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const result = await res.json();
    if (result.success) {
      setRewards(prev => prev.map(r => r.id === id ? { ...r, is_active: false } : r));
      showMessage('Reward deactivated!');
    } else {
      showMessage(`Error: ${result.error}`);
    }
  }

  async function reactivateReward(id: string) {
    const res = await fetch('/api/rewards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: true }) });
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

  async function saveResetSchedule(value: string) {
    setResetSchedule(value);
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_reset_schedule', value }) });
    const result = await res.json();
    showMessage(result.success ? 'Reset schedule updated!' : `Error: ${result.error}`);
  }

  async function performReset() {
    setResetting(true); setShowResetConfirm(false);
    const res = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    const result = await res.json();
    setResetting(false);
    if (result.success) { setLastResetAt(new Date().toISOString()); showMessage('Points reset successfully!'); }
    else { showMessage(`Error: ${result.error}`); }
  }

  async function savePin(kidId: string) {
    const pin = kidPins[kidId];
    if (!pin || !/^\d{4}$/.test(pin)) { showMessage('PIN must be exactly 4 digits'); return; }
    setSavingPin(kidId);
    const res = await fetch('/api/kids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_pin', kid_id: kidId, pin }) });
    const result = await res.json();
    setSavingPin(null);
    if (result.success) {
      setKidsList(prev => prev.map(k => k.id === kidId ? { ...k, has_pin: true } : k));
      setKidPins(prev => ({ ...prev, [kidId]: '' }));
      showMessage('PIN saved!');
    } else { showMessage(`Error: ${result.error}`); }
  }

  if (loading) {
    return (
      <div className="text-center" style={{ padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#x23F3;</div>
        <div style={{ color: 'var(--text-secondary)' }}>Loading settings...</div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center" style={{ padding: 48, color: 'var(--accent-red)' }}>Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div style={{
          background: 'rgba(0, 176, 255, 0.15)',
          border: '1px solid rgba(0, 176, 255, 0.3)',
          color: 'var(--accent-blue)',
          padding: '12px 16px',
          borderRadius: 6,
          fontSize: 14,
        }}>
          {message}
        </div>
      )}

      {/* Profile */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Profile</h2>
        <div className="space-y-4" style={{ marginTop: 12 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="text" value={data.parent.email} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
          </div>
          <div>
            <label style={labelStyle}>Display Name</label>
            <div className="flex gap-2">
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={saveDisplayName} disabled={saving || displayName === data.parent.display_name} style={{ ...btnPrimary, opacity: (saving || displayName === data.parent.display_name) ? 0.5 : 1 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Family Invite Code */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Invite Code</h2>
        <p style={sectionDescStyle}>
          Share this code with your kids so they can link their Telegram chat using <code style={{ background: 'var(--bg-dark)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/join {inviteCode || '...'}</code>
        </p>
        <div className="flex items-center gap-3">
          {inviteCode ? (
            <>
              <span style={{
                fontFamily: "'Silkscreen', monospace", fontSize: 20, fontWeight: 700,
                letterSpacing: 3, background: 'var(--bg-dark)',
                padding: '8px 16px', borderRadius: 8, border: '2px solid var(--border-color)',
                color: 'var(--accent-green)',
              }}>
                {inviteCode}
              </span>
              <button onClick={copyInviteCode} style={btnPrimary}>Copy</button>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No invite code yet.</span>
          )}
          <button onClick={regenerateInviteCode} disabled={regenerating} style={{ ...btnSecondary, opacity: regenerating ? 0.5 : 1 }}>
            {regenerating ? 'Generating...' : inviteCode ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Rewards Catalog */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Rewards Catalog</h2>
        <p style={sectionDescStyle}>Define rewards that kids can redeem their stars for via Telegram.</p>

        {rewards.length > 0 ? (
          <div className="space-y-2" style={{ marginBottom: 20 }}>
            {rewards.map(reward => (
              <div key={reward.id} className="flex items-center justify-between" style={{
                borderRadius: 8, padding: '10px 14px',
                background: reward.is_active ? 'var(--bg-dark)' : 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                opacity: reward.is_active ? 1 : 0.5,
              }}>
                {editingReward === reward.id ? (
                  <div className="flex items-end gap-2" style={{ flex: 1 }}>
                    <input type="text" value={editRewardName} onChange={e => setEditRewardName(e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 13 }} />
                    <input type="text" value={editRewardDesc} onChange={e => setEditRewardDesc(e.target.value)} placeholder="Description" style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 13 }} />
                    <input type="number" value={editRewardCost} onChange={e => setEditRewardCost(e.target.value)} min="1" style={{ ...inputStyle, width: 70, padding: '6px 10px', fontSize: 13 }} />
                    <button onClick={() => updateReward(reward.id)} style={{ fontSize: 12, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                    <button onClick={() => setEditingReward(null)} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{reward.name}</span>
                      {reward.description && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({reward.description})</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-yellow)' }}>{reward.star_cost} stars</span>
                      {!reward.is_active && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>(inactive)</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEditing(reward)} style={{ fontSize: 12, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      {reward.is_active ? (
                        <button onClick={() => deleteReward(reward.id)} style={{ fontSize: 12, color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                      ) : (
                        <button onClick={() => reactivateReward(reward.id)} style={{ fontSize: 12, color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer' }}>Reactivate</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>No rewards configured yet.</p>
        )}

        <div className="flex items-end gap-2">
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Name</label>
            <input type="text" value={newRewardName} onChange={e => setNewRewardName(e.target.value)} placeholder="e.g. Screen Time (30 min)" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Description</label>
            <input type="text" value={newRewardDesc} onChange={e => setNewRewardDesc(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
          <div style={{ width: 90 }}>
            <label style={labelStyle}>Stars</label>
            <input type="number" value={newRewardCost} onChange={e => setNewRewardCost(e.target.value)} placeholder="5" min="1" style={inputStyle} />
          </div>
          <button onClick={addReward} disabled={!newRewardName.trim() || !newRewardCost || parseInt(newRewardCost) < 1} style={{ ...btnPrimary, opacity: (!newRewardName.trim() || !newRewardCost) ? 0.5 : 1 }}>
            Add
          </button>
        </div>
      </div>

      {/* Reset Schedule */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Points Reset</h2>
        <p style={sectionDescStyle}>Automatically reset star balances on a schedule.</p>
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>Schedule</label>
            <select value={resetSchedule} onChange={e => saveResetSchedule(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="none">None (manual only)</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {lastResetAt && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Last reset: {new Date(lastResetAt).toLocaleDateString()} {new Date(lastResetAt).toLocaleTimeString()}
            </p>
          )}
          <div>
            {showResetConfirm ? (
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>Are you sure? This will zero out all balances.</span>
                <button onClick={performReset} disabled={resetting} style={{ ...btnDanger, opacity: resetting ? 0.5 : 1 }}>
                  {resetting ? 'Resetting...' : 'Yes, Reset Now'}
                </button>
                <button onClick={() => setShowResetConfirm(false)} style={btnSecondary}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowResetConfirm(true)} style={btnDanger}>Reset Now</button>
            )}
          </div>
        </div>
      </div>

      {/* Redemption PINs */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Redemption PINs</h2>
        <p style={sectionDescStyle}>Set a 4-digit PIN for each kid to verify identity when redeeming.</p>
        {kidsList.length > 0 ? (
          <div className="space-y-2">
            {kidsList.map(kid => (
              <div key={kid.id} className="flex items-center gap-3" style={{
                background: 'var(--bg-dark)', borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{kid.display_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>@{kid.username}</span>
                  {kid.has_pin && <span style={{ fontSize: 11, color: 'var(--accent-green)', marginLeft: 8 }}>(PIN set)</span>}
                  {!kid.has_pin && <span style={{ fontSize: 11, color: 'var(--accent-orange)', marginLeft: 8 }}>(no PIN)</span>}
                </div>
                <input
                  type="password" maxLength={4} placeholder="4-digit PIN"
                  value={kidPins[kid.id] || ''}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setKidPins(prev => ({ ...prev, [kid.id]: val }));
                  }}
                  style={{ ...inputStyle, width: 100, textAlign: 'center', letterSpacing: 4, padding: '6px 10px', fontSize: 14 }}
                />
                <button
                  onClick={() => savePin(kid.id)}
                  disabled={savingPin === kid.id || !kidPins[kid.id] || kidPins[kid.id]?.length !== 4}
                  style={{ ...btnPrimary, opacity: (savingPin === kid.id || !kidPins[kid.id] || kidPins[kid.id]?.length !== 4) ? 0.5 : 1, fontSize: 12 }}
                >
                  {savingPin === kid.id ? 'Saving...' : kid.has_pin ? 'Change' : 'Set PIN'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No kids found.</p>
        )}
      </div>

      {/* Kid Assignments */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Kid Assignments</h2>
        <p style={sectionDescStyle}>Select which kids you can see in the dashboard.</p>
        <div className="space-y-2" style={{ marginBottom: 16 }}>
          {data.allKids.map(kid => (
            <label key={kid.id} className="flex items-center gap-3" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={assignedKids.has(kid.id)}
                onChange={() => toggleKid(kid.id)}
                style={{ accentColor: 'var(--accent-green)' }}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{kid.display_name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{kid.username}</span>
            </label>
          ))}
        </div>
        <button onClick={saveKidAssignments} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          Save Assignments
        </button>
      </div>

      {/* Notification Contacts */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>Notifications</h2>
        <p style={sectionDescStyle}>Add your Telegram or WhatsApp ID to receive notifications.</p>

        {data.contacts.length > 0 ? (
          <div className="space-y-2" style={{ marginBottom: 20 }}>
            {data.contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between" style={{
                background: 'var(--bg-dark)', borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border-color)',
              }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{contact.platform}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>{contact.platform_user_id}</span>
                </div>
                <button onClick={() => deleteContact(contact.id)} style={{ fontSize: 12, color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>No contacts configured.</p>
        )}

        <div className="flex items-end gap-2">
          <div>
            <label style={labelStyle}>Platform</label>
            <select value={newPlatform} onChange={e => setNewPlatform(e.target.value as 'telegram' | 'whatsapp')} style={{ ...inputStyle, width: 'auto' }}>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>User/Chat ID</label>
            <input type="text" value={newPlatformUserId} onChange={e => setNewPlatformUserId(e.target.value)} placeholder="e.g. 123456789" style={inputStyle} />
          </div>
          <button onClick={addContact} disabled={!newPlatformUserId.trim()} style={{ ...btnPrimary, opacity: !newPlatformUserId.trim() ? 0.5 : 1 }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

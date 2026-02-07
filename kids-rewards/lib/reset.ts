/**
 * Points Reset Logic
 *
 * Shared by manual reset (POST /api/reset) and auto-reset (GET /api/cron/reset).
 * Zeroes out all kid balances by inserting negative ledger entries,
 * and records an audit snapshot in points_resets.
 */

import { supabaseAdmin } from './supabase';

export async function performReset(
  householdId: string,
  triggeredBy: 'manual' | 'auto_monthly' | 'auto_yearly'
): Promise<{ success: boolean; kidTotals: Record<string, number> }> {
  // Get all kids in household
  const { data: kids } = await supabaseAdmin
    .from('kids')
    .select('id, display_name')
    .eq('household_id', householdId);

  if (!kids || kids.length === 0) {
    return { success: true, kidTotals: {} };
  }

  const kidTotals: Record<string, number> = {};

  for (const kid of kids) {
    // Calculate current balance from ledger
    const { data: ledger } = await supabaseAdmin
      .from('points_ledger')
      .select('delta_points')
      .eq('kid_id', kid.id);

    const balance = ledger?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;
    kidTotals[kid.display_name] = balance;

    // Insert negative entry to zero out balance
    if (balance !== 0) {
      await supabaseAdmin
        .from('points_ledger')
        .insert({
          kid_id: kid.id,
          delta_points: -balance,
          reason: `Period reset (${triggeredBy})`,
          submission_id: null,
        });
    }
  }

  // Build period label
  const now = new Date();
  const periodLabel = triggeredBy === 'auto_yearly'
    ? `${now.getFullYear()}`
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Record in points_resets
  await supabaseAdmin
    .from('points_resets')
    .insert({
      household_id: householdId,
      period_label: periodLabel,
      triggered_by: triggeredBy,
      kid_totals: kidTotals,
    });

  // Update household settings with last_reset_at
  const { data: household } = await supabaseAdmin
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .single();

  const updatedSettings = { ...(household?.settings || {}), last_reset_at: now.toISOString() };

  await supabaseAdmin
    .from('households')
    .update({ settings: updatedSettings })
    .eq('id', householdId);

  return { success: true, kidTotals };
}

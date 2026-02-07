import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/redemptions
 *
 * Returns redemptions for the parent's household.
 * Query params: ?kid_id=&status=
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const kidId = searchParams.get('kid_id');
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('redemptions')
    .select('*, kids(display_name, username)')
    .eq('household_id', parent.household_id)
    .order('created_at', { ascending: false });

  if (kidId) {
    query = query.eq('kid_id', kidId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data: redemptions } = await query;

  return NextResponse.json(redemptions || []);
}

/**
 * POST /api/redemptions
 *
 * Approve or deny a redemption from the dashboard.
 * Body: { action: 'approve'|'deny', redemption_id, comment? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const body = await request.json();
  const { action, redemption_id } = body;

  if (!action || !redemption_id) {
    return NextResponse.json({ error: 'action and redemption_id are required' }, { status: 400 });
  }

  // Fetch redemption
  const { data: redemption } = await supabaseAdmin
    .from('redemptions')
    .select('*')
    .eq('id', redemption_id)
    .eq('household_id', parent.household_id)
    .single();

  if (!redemption) {
    return NextResponse.json({ error: 'Redemption not found' }, { status: 404 });
  }

  if (redemption.status !== 'pending') {
    return NextResponse.json({ error: 'Redemption already resolved' }, { status: 400 });
  }

  if (action === 'approve') {
    // Re-check balance before approving
    const { data: ledger } = await supabaseAdmin
      .from('points_ledger')
      .select('delta_points')
      .eq('kid_id', redemption.kid_id);

    const balance = ledger?.reduce((sum: number, e: any) => sum + e.delta_points, 0) || 0;

    if (balance < redemption.star_cost) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Deduct points via ledger
    await supabaseAdmin
      .from('points_ledger')
      .insert({
        kid_id: redemption.kid_id,
        delta_points: -redemption.star_cost,
        reason: `Redeemed: ${redemption.reward_name}`,
        submission_id: null,
      });

    // Update redemption
    await supabaseAdmin
      .from('redemptions')
      .update({
        status: 'approved',
        parent_user_id: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', redemption_id);

    return NextResponse.json({ success: true, status: 'approved' });

  } else if (action === 'deny') {
    await supabaseAdmin
      .from('redemptions')
      .update({
        status: 'denied',
        parent_user_id: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', redemption_id);

    return NextResponse.json({ success: true, status: 'denied' });

  } else {
    return NextResponse.json({ error: 'action must be approve or deny' }, { status: 400 });
  }
}

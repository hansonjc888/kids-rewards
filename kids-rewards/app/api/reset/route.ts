import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { performReset } from '@/lib/reset';

/**
 * POST /api/reset
 *
 * Manual points reset for the parent's household.
 * Body: { confirm: true }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body.confirm) {
    return NextResponse.json({ error: 'Must pass { confirm: true }' }, { status: 400 });
  }

  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const result = await performReset(parent.household_id, 'manual');

  return NextResponse.json({
    success: result.success,
    kid_totals: result.kidTotals,
  });
}

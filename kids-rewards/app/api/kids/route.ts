import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  // RLS automatically filters to assigned kids
  const { data: kids, error } = await supabase
    .from('kids')
    .select('*')
    .order('display_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get stats for each kid
  const kidsWithStats = await Promise.all(
    kids.map(async (kid) => {
      const { data: ledger } = await supabase
        .from('points_ledger')
        .select('delta_points')
        .eq('kid_id', kid.id);

      const total_stars = ledger?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;

      const { count: totalCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('kid_id', kid.id);

      const { count: approvedCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('kid_id', kid.id)
        .eq('status', 'approved');

      return {
        ...kid,
        has_pin: !!kid.pin,
        total_stars,
        submission_count: totalCount || 0,
        approved_count: approvedCount || 0
      };
    })
  );

  // Strip actual pin values from response
  const safeKids = kidsWithStats.map(({ pin, ...rest }) => rest);

  return NextResponse.json(safeKids);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  if (body.action === 'set_pin') {
    const { kid_id, pin } = body;

    if (!kid_id || !pin) {
      return NextResponse.json({ error: 'kid_id and pin are required' }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    const { error } = await supabase
      .from('kids')
      .update({ pin })
      .eq('id', kid_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

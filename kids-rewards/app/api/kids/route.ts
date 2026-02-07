import { NextResponse } from 'next/server';
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
        total_stars,
        submission_count: totalCount || 0,
        approved_count: approvedCount || 0
      };
    })
  );

  return NextResponse.json(kidsWithStats);
}

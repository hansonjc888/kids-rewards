import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split('T')[0];

  // RLS automatically scopes all queries to assigned kids

  // Today's submissions
  const { data: todaySubmissions, count: todayCount } = await supabase
    .from('submissions')
    .select('*, approvals(stars)', { count: 'exact' })
    .gte('created_at', `${today}T00:00:00`);

  // Total submissions
  const { count: totalSubmissions } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true });

  // Total stars awarded
  const { data: allLedger } = await supabase
    .from('points_ledger')
    .select('delta_points');

  const totalStars = allLedger?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;

  // Today's stars
  const todayStars = todaySubmissions?.reduce((sum: number, sub: any) => {
    return sum + (sub.approvals?.[0]?.stars || 0);
  }, 0) || 0;

  // Pending count
  const { count: pendingCount } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review');

  // Category breakdown (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentSubmissions } = await supabase
    .from('submissions')
    .select('category')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('status', 'approved');

  const categoryBreakdown: Record<string, number> = {};
  recentSubmissions?.forEach((sub) => {
    categoryBreakdown[sub.category] = (categoryBreakdown[sub.category] || 0) + 1;
  });

  return NextResponse.json({
    today: {
      submissions: todayCount || 0,
      stars: todayStars
    },
    total: {
      submissions: totalSubmissions || 0,
      stars: totalStars
    },
    pending: pendingCount || 0,
    categoryBreakdown
  });
}

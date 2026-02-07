import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const searchParams = request.nextUrl.searchParams;
  const kidId = searchParams.get('kid_id');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  // RLS automatically filters to assigned kids via kids!inner join
  let query = supabase
    .from('submissions')
    .select(`
      *,
      kids!inner (id, display_name, username),
      approvals (stars, created_at)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (kidId) {
    query = query.eq('kid_id', kidId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

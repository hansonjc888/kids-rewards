import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const kidId = request.nextUrl.searchParams.get('kid_id');

  if (!kidId) {
    return NextResponse.json({ error: 'kid_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('points_ledger')
    .select('id, delta_points, reason, created_at')
    .eq('kid_id', kidId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

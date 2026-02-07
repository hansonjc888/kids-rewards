import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/me
 *
 * Returns the current authenticated parent's profile.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: parent, error } = await supabase
    .from('parents')
    .select('id, display_name, email, household_id')
    .eq('id', user.id)
    .single();

  if (error || !parent) {
    return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 });
  }

  // Get household name
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', parent.household_id)
    .single();

  return NextResponse.json({
    ...parent,
    household_name: household?.name || 'Unknown',
  });
}

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/invite-code';

/**
 * POST /api/onboarding
 *
 * Creates a household, kids, parent record, and parent-kid assignments
 * for a newly authenticated user. Uses service role to bypass RLS.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if parent record already exists (prevent duplicate onboarding)
  const { data: existingParent } = await supabaseAdmin
    .from('parents')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingParent) {
    return NextResponse.json({ error: 'Onboarding already completed' }, { status: 409 });
  }

  const body = await request.json();
  const { familyName, kids } = body as { familyName: string; kids: string[] };

  if (!familyName || !kids || kids.length === 0) {
    return NextResponse.json({ error: 'Family name and at least one kid are required' }, { status: 400 });
  }

  // 1. Create household with invite code
  const inviteCode = generateInviteCode();
  const { data: household, error: hhError } = await supabaseAdmin
    .from('households')
    .insert({ name: familyName, settings: { timezone: 'UTC', invite_code: inviteCode } })
    .select()
    .single();

  if (hhError || !household) {
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
  }

  // 2. Create kids
  const kidRows = kids.map((name: string) => ({
    household_id: household.id,
    display_name: name,
    username: name.toLowerCase(),
  }));

  const { data: createdKids, error: kidError } = await supabaseAdmin
    .from('kids')
    .insert(kidRows)
    .select();

  if (kidError || !createdKids) {
    // Cleanup: remove the household we just created
    await supabaseAdmin.from('households').delete().eq('id', household.id);
    return NextResponse.json({ error: 'Failed to create kids' }, { status: 500 });
  }

  // 3. Create parent record
  const displayName = user.user_metadata?.display_name || user.email || 'Parent';
  const { error: parentError } = await supabaseAdmin
    .from('parents')
    .insert({
      id: user.id,
      household_id: household.id,
      display_name: displayName,
      email: user.email,
    });

  if (parentError) {
    // Cleanup
    await supabaseAdmin.from('kids').delete().eq('household_id', household.id);
    await supabaseAdmin.from('households').delete().eq('id', household.id);
    return NextResponse.json({ error: 'Failed to create parent record' }, { status: 500 });
  }

  // 4. Create parent-kid assignments
  const assignments = createdKids.map((kid) => ({
    parent_id: user.id,
    kid_id: kid.id,
  }));

  const { error: assignError } = await supabaseAdmin
    .from('parent_kid_assignments')
    .insert(assignments);

  if (assignError) {
    // Cleanup
    await supabaseAdmin.from('parents').delete().eq('id', user.id);
    await supabaseAdmin.from('kids').delete().eq('household_id', household.id);
    await supabaseAdmin.from('households').delete().eq('id', household.id);
    return NextResponse.json({ error: 'Failed to link parent to kids' }, { status: 500 });
  }

  return NextResponse.json({
    household_id: household.id,
    kids: createdKids.map((k) => ({ id: k.id, display_name: k.display_name })),
  });
}

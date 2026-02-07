import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/invite-code';

/**
 * GET /api/settings
 *
 * Returns the parent's profile, assigned kids, contacts, and all household kids.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get parent profile
  const { data: parent } = await supabase
    .from('parents')
    .select('id, display_name, email, household_id')
    .eq('id', user.id)
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  // Get assigned kid IDs
  const { data: assignments } = await supabase
    .from('parent_kid_assignments')
    .select('kid_id')
    .eq('parent_id', user.id);

  const assignedKidIds = assignments?.map(a => a.kid_id) || [];

  // Get all kids in household (use admin client since RLS limits to assigned only)
  const { data: allKids } = await supabaseAdmin
    .from('kids')
    .select('id, display_name, username')
    .eq('household_id', parent.household_id)
    .order('display_name');

  // Get contacts
  const { data: contacts } = await supabase
    .from('parent_contacts')
    .select('id, platform, platform_user_id')
    .eq('parent_id', user.id);

  // Get household invite code
  const { data: household } = await supabaseAdmin
    .from('households')
    .select('settings')
    .eq('id', parent.household_id)
    .single();

  const inviteCode = household?.settings?.invite_code || null;
  const resetSchedule = household?.settings?.reset_schedule || 'none';
  const lastResetAt = household?.settings?.last_reset_at || null;

  return NextResponse.json({
    parent,
    assignedKidIds,
    allKids: allKids || [],
    contacts: contacts || [],
    inviteCode,
    resetSchedule,
    lastResetAt,
  });
}

/**
 * PUT /api/settings
 *
 * Update parent display name.
 * Body: { display_name: string }
 */
export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { display_name } = body;

  if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('parents')
    .update({ display_name: display_name.trim() })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/settings
 *
 * Update kid assignments.
 * Body: { kid_ids: string[] }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { kid_ids } = body;

  if (!Array.isArray(kid_ids)) {
    return NextResponse.json({ error: 'kid_ids must be an array' }, { status: 400 });
  }

  // Delete all existing assignments
  await supabaseAdmin
    .from('parent_kid_assignments')
    .delete()
    .eq('parent_id', user.id);

  // Insert new assignments
  if (kid_ids.length > 0) {
    const rows = kid_ids.map(kid_id => ({
      parent_id: user.id,
      kid_id,
    }));

    const { error } = await supabaseAdmin
      .from('parent_kid_assignments')
      .insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * POST /api/settings
 *
 * Add a contact or delete a contact.
 * Body (add): { action: 'add_contact', platform: 'telegram'|'whatsapp', platform_user_id: string }
 * Body (delete): { action: 'delete_contact', contact_id: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === 'regenerate_invite_code') {
    // Get parent's household
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const newCode = generateInviteCode();

    // Update household settings with new invite code
    const { data: household } = await supabaseAdmin
      .from('households')
      .select('settings')
      .eq('id', parent.household_id)
      .single();

    const updatedSettings = { ...(household?.settings || {}), invite_code: newCode };

    const { error } = await supabaseAdmin
      .from('households')
      .update({ settings: updatedSettings })
      .eq('id', parent.household_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, invite_code: newCode });
  }

  if (body.action === 'add_contact') {
    const { platform, platform_user_id } = body;

    if (!platform || !platform_user_id) {
      return NextResponse.json({ error: 'platform and platform_user_id required' }, { status: 400 });
    }

    if (platform !== 'telegram' && platform !== 'whatsapp') {
      return NextResponse.json({ error: 'platform must be telegram or whatsapp' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('parent_contacts')
      .upsert({
        parent_id: user.id,
        platform,
        platform_user_id: platform_user_id.trim(),
      }, { onConflict: 'parent_id,platform,platform_user_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.action === 'delete_contact') {
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    // Only delete contacts that belong to this parent
    const { error } = await supabaseAdmin
      .from('parent_contacts')
      .delete()
      .eq('id', contact_id)
      .eq('parent_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.action === 'update_reset_schedule') {
    const { value } = body;

    if (!['none', 'monthly', 'yearly'].includes(value)) {
      return NextResponse.json({ error: 'value must be none, monthly, or yearly' }, { status: 400 });
    }

    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const { data: household } = await supabaseAdmin
      .from('households')
      .select('settings')
      .eq('id', parent.household_id)
      .single();

    const updatedSettings = { ...(household?.settings || {}), reset_schedule: value };

    const { error } = await supabaseAdmin
      .from('households')
      .update({ settings: updatedSettings })
      .eq('id', parent.household_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

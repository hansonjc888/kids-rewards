import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/rewards
 *
 * Returns all active rewards for the parent's household.
 */
export async function GET() {
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

  const { data: rewards } = await supabaseAdmin
    .from('rewards')
    .select('*')
    .eq('household_id', parent.household_id)
    .order('created_at', { ascending: false });

  return NextResponse.json(rewards || []);
}

/**
 * POST /api/rewards
 *
 * Create a new reward.
 * Body: { name, description?, star_cost }
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
  const { name, description, star_cost } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!star_cost || typeof star_cost !== 'number' || star_cost < 1) {
    return NextResponse.json({ error: 'star_cost must be a positive integer' }, { status: 400 });
  }

  const { data: reward, error } = await supabaseAdmin
    .from('rewards')
    .insert({
      household_id: parent.household_id,
      name: name.trim(),
      description: description?.trim() || null,
      star_cost: Math.floor(star_cost),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(reward, { status: 201 });
}

/**
 * PUT /api/rewards
 *
 * Update a reward.
 * Body: { id, name?, description?, star_cost?, is_active? }
 */
export async function PUT(request: NextRequest) {
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
  const { id, name, description, star_cost, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (star_cost !== undefined) {
    if (typeof star_cost !== 'number' || star_cost < 1) {
      return NextResponse.json({ error: 'star_cost must be a positive integer' }, { status: 400 });
    }
    updates.star_cost = Math.floor(star_cost);
  }
  if (is_active !== undefined) updates.is_active = !!is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('rewards')
    .update(updates)
    .eq('id', id)
    .eq('household_id', parent.household_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/rewards
 *
 * Soft-delete a reward (set is_active = false).
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
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
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('rewards')
    .update({ is_active: false })
    .eq('id', id)
    .eq('household_id', parent.household_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

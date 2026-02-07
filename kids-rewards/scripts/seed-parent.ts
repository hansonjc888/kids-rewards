/**
 * Seed script: Create a parent account and link to kids.
 *
 * Creates a parent user in Supabase Auth, inserts into `parents` table,
 * links to all kids via `parent_kid_assignments`, and optionally adds
 * a Telegram contact from PARENT_CHAT_ID env var.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/seed-parent.ts
 *
 * Environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (required for admin operations)
 *   PARENT_EMAIL - Email for the parent account (default: parent@example.com)
 *   PARENT_PASSWORD - Password for the parent account (default: password123)
 *   PARENT_NAME - Display name (default: Parent)
 *   PARENT_CHAT_ID - Telegram chat ID to register as contact (optional)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const PARENT_EMAIL = process.env.PARENT_EMAIL || 'parent@example.com';
const PARENT_PASSWORD = process.env.PARENT_PASSWORD || 'password123';
const PARENT_NAME = process.env.PARENT_NAME || 'Parent';
const PARENT_CHAT_ID = process.env.PARENT_CHAT_ID;

async function main() {
  console.log('--- Seed Parent Account ---\n');

  // 1. Get household
  const { data: household, error: hhError } = await supabase
    .from('households')
    .select('id, name')
    .limit(1)
    .single();

  if (hhError || !household) {
    console.error('No household found. Run supabase-schema.sql first.');
    process.exit(1);
  }

  console.log(`Household: ${household.name} (${household.id})`);

  // 2. Create auth user
  console.log(`\nCreating auth user: ${PARENT_EMAIL}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('User already exists — looking up existing user...');
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find(u => u.email === PARENT_EMAIL);
      if (!existing) {
        console.error('Could not find existing user');
        process.exit(1);
      }
      await seedParentData(existing.id, household.id);
    } else {
      console.error('Error creating user:', authError.message);
      process.exit(1);
    }
  } else {
    console.log(`Auth user created: ${authData.user.id}`);
    await seedParentData(authData.user.id, household.id);
  }
}

async function seedParentData(userId: string, householdId: string) {
  // 3. Insert into parents table
  console.log('\nInserting parent record...');

  const { error: parentError } = await supabase
    .from('parents')
    .upsert({
      id: userId,
      household_id: householdId,
      display_name: PARENT_NAME,
      email: PARENT_EMAIL,
    });

  if (parentError) {
    console.error('Error inserting parent:', parentError.message);
    process.exit(1);
  }

  console.log('Parent record created.');

  // 4. Get all kids in household
  const { data: kids } = await supabase
    .from('kids')
    .select('id, display_name, username')
    .eq('household_id', householdId);

  if (!kids || kids.length === 0) {
    console.log('No kids found in household.');
  } else {
    // 5. Link parent to all kids
    console.log(`\nLinking parent to ${kids.length} kids...`);

    for (const kid of kids) {
      const { error: linkError } = await supabase
        .from('parent_kid_assignments')
        .upsert({
          parent_id: userId,
          kid_id: kid.id,
        }, { onConflict: 'parent_id,kid_id' });

      if (linkError) {
        console.error(`  Error linking to ${kid.display_name}:`, linkError.message);
      } else {
        console.log(`  Linked to ${kid.display_name} (@${kid.username})`);
      }
    }
  }

  // 6. Add Telegram contact if PARENT_CHAT_ID is set
  if (PARENT_CHAT_ID) {
    console.log(`\nAdding Telegram contact: ${PARENT_CHAT_ID}`);

    const { error: contactError } = await supabase
      .from('parent_contacts')
      .upsert({
        parent_id: userId,
        platform: 'telegram',
        platform_user_id: PARENT_CHAT_ID,
      }, { onConflict: 'parent_id,platform,platform_user_id' });

    if (contactError) {
      console.error('Error adding contact:', contactError.message);
    } else {
      console.log('Telegram contact added.');
    }
  } else {
    console.log('\nNo PARENT_CHAT_ID set — skipping Telegram contact.');
  }

  console.log('\n--- Done! ---');
  console.log(`\nLogin credentials:`);
  console.log(`  Email:    ${PARENT_EMAIL}`);
  console.log(`  Password: ${PARENT_PASSWORD}`);
}

main().catch(console.error);

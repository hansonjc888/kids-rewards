/**
 * Seed script: Create a new household with kids and a parent account.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/seed-family.ts
 *
 * Environment variables (required):
 *   FAMILY_NAME       - Household name (e.g. "Smith Family")
 *   KIDS              - Comma-separated kid names (e.g. "Alice,Bob,Charlie")
 *   PARENT_EMAIL      - Email for the parent account
 *   PARENT_PASSWORD   - Password for the parent account
 *   PARENT_NAME       - Parent display name
 *
 * Optional:
 *   PARENT_CHAT_ID    - Telegram chat ID for notifications
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const FAMILY_NAME = process.env.FAMILY_NAME;
const KIDS = process.env.KIDS;
const PARENT_EMAIL = process.env.PARENT_EMAIL;
const PARENT_PASSWORD = process.env.PARENT_PASSWORD;
const PARENT_NAME = process.env.PARENT_NAME;
const PARENT_CHAT_ID = process.env.PARENT_CHAT_ID;

if (!FAMILY_NAME || !KIDS || !PARENT_EMAIL || !PARENT_PASSWORD || !PARENT_NAME) {
  console.error('Missing required env vars. Set:');
  console.error('  FAMILY_NAME="Smith Family"');
  console.error('  KIDS="Alice,Bob,Charlie"');
  console.error('  PARENT_EMAIL="parent@example.com"');
  console.error('  PARENT_PASSWORD="password123"');
  console.error('  PARENT_NAME="Dad"');
  process.exit(1);
}

const kidNames = KIDS.split(',').map(n => n.trim()).filter(Boolean);

async function main() {
  console.log(`\n--- Creating Family: ${FAMILY_NAME} ---\n`);

  // 1. Create household
  const { data: household, error: hhError } = await supabase
    .from('households')
    .insert({ name: FAMILY_NAME, settings: { timezone: 'UTC' } })
    .select()
    .single();

  if (hhError) {
    console.error('Error creating household:', hhError.message);
    process.exit(1);
  }

  console.log(`Household: ${household.name} (${household.id})`);

  // 2. Create kids
  console.log(`\nCreating ${kidNames.length} kids...`);

  const kidRows = kidNames.map(name => ({
    household_id: household.id,
    display_name: name,
    username: name.toLowerCase(),
  }));

  const { data: kids, error: kidError } = await supabase
    .from('kids')
    .insert(kidRows)
    .select();

  if (kidError) {
    console.error('Error creating kids:', kidError.message);
    process.exit(1);
  }

  for (const kid of kids!) {
    console.log(`  ${kid.display_name} (@${kid.username})`);
  }

  // 3. Create auth user
  console.log(`\nCreating parent auth user: ${PARENT_EMAIL}`);

  let userId: string;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: PARENT_EMAIL,
    password: PARENT_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('User already exists — looking up...');
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users.find(u => u.email === PARENT_EMAIL);
      if (!existing) {
        console.error('Could not find existing user');
        process.exit(1);
      }
      userId = existing.id;
    } else {
      console.error('Error creating user:', authError.message);
      process.exit(1);
    }
  } else {
    userId = authData.user.id;
  }

  console.log(`Auth user ID: ${userId}`);

  // 4. Insert parent record
  const { error: parentError } = await supabase
    .from('parents')
    .upsert({
      id: userId,
      household_id: household.id,
      display_name: PARENT_NAME,
      email: PARENT_EMAIL,
    });

  if (parentError) {
    console.error('Error inserting parent:', parentError.message);
    process.exit(1);
  }

  // 5. Link parent to all kids
  console.log('\nLinking parent to kids...');

  for (const kid of kids!) {
    const { error } = await supabase
      .from('parent_kid_assignments')
      .upsert({ parent_id: userId, kid_id: kid.id }, { onConflict: 'parent_id,kid_id' });

    if (error) {
      console.error(`  Error linking ${kid.display_name}:`, error.message);
    } else {
      console.log(`  Linked to ${kid.display_name}`);
    }
  }

  // 6. Add Telegram contact if set
  if (PARENT_CHAT_ID) {
    console.log(`\nAdding Telegram contact: ${PARENT_CHAT_ID}`);
    await supabase
      .from('parent_contacts')
      .upsert({
        parent_id: userId,
        platform: 'telegram',
        platform_user_id: PARENT_CHAT_ID,
      }, { onConflict: 'parent_id,platform,platform_user_id' });
  }

  console.log('\n--- Done! ---');
  console.log(`\nLogin credentials:`);
  console.log(`  Email:    ${PARENT_EMAIL}`);
  console.log(`  Password: ${PARENT_PASSWORD}`);
  console.log(`\nKids: ${kidNames.map(n => `@${n.toLowerCase()}`).join(', ')}`);
}

main().catch(console.error);

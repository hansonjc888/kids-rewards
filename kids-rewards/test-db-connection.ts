import { supabaseAdmin } from './lib/supabase';

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  // Test 1: Fetch households
  const { data: households, error: hError } = await supabaseAdmin
    .from('households')
    .select('*');

  if (hError) {
    console.error('❌ Error fetching households:', hError);
    return;
  }

  console.log('✅ Households:', households);

  // Test 2: Fetch kids
  const { data: kids, error: kError } = await supabaseAdmin
    .from('kids')
    .select('id, username, display_name, household_id');

  if (kError) {
    console.error('❌ Error fetching kids:', kError);
    return;
  }

  console.log('✅ Kids:', kids);

  // Test 3: Test identity lookup
  if (kids && kids.length > 0) {
    const householdId = kids[0].household_id;
    
    const { data: alice, error: aError } = await supabaseAdmin
      .from('kids')
      .select('id, display_name, username')
      .eq('household_id', householdId)
      .ilike('username', 'alice')
      .single();

    if (aError) {
      console.error('❌ Error finding Alice:', aError);
    } else {
      console.log('✅ Identity lookup test (alice):', alice);
    }
  }

  console.log('\n🎉 Database connection successful!');
}

testConnection().catch(console.error);

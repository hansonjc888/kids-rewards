import { supabaseAdmin } from './supabase';

/**
 * Get all parent contact IDs for a given kid on a given platform.
 * Falls back to PARENT_CHAT_ID env var if no DB contacts found.
 */
export async function getParentContactsForKid(
  kidId: string,
  platform: 'telegram' | 'whatsapp'
): Promise<string[]> {
  // Find all parents assigned to this kid
  const { data: assignments } = await supabaseAdmin
    .from('parent_kid_assignments')
    .select('parent_id')
    .eq('kid_id', kidId);

  if (assignments && assignments.length > 0) {
    const parentIds = assignments.map(a => a.parent_id);

    // Get their contacts for the given platform
    const { data: contacts } = await supabaseAdmin
      .from('parent_contacts')
      .select('platform_user_id')
      .eq('platform', platform)
      .in('parent_id', parentIds);

    if (contacts && contacts.length > 0) {
      return contacts.map(c => c.platform_user_id);
    }
  }

  // Fallback: use env var for backward compatibility
  const envFallback = process.env.PARENT_CHAT_ID;
  if (envFallback) {
    return [envFallback];
  }

  return [];
}

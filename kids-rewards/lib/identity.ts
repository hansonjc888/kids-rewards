/**
 * Identity Resolution for Kids Reward System
 *
 * CRITICAL: Identity must be explicit and deterministic.
 * Never use AI or guessing to determine identity.
 */

export interface ParsedIdentity {
  username: string | null;
  cleanText: string;
}

/**
 * Parse @name from message text
 *
 * Examples:
 *   "@Alice Read 20 pages" -> { username: "Alice", cleanText: "Read 20 pages" }
 *   "Read 20 pages" -> { username: null, cleanText: "Read 20 pages" }
 *   "@alice hello" -> { username: "alice", cleanText: "hello" }
 *
 * Rules:
 * - Must start with @ followed by alphanumeric characters
 * - Username is case-insensitive
 * - Only first @name is parsed
 * - Text after @name is the clean text
 */
export function parseIdentity(text: string): ParsedIdentity {
  // Trim the text
  const trimmed = text.trim();

  // Regex to match @username at the start
  // Pattern: ^@ followed by one or more word characters (letters, numbers, underscore)
  const match = trimmed.match(/^@(\w+)/);

  if (!match) {
    return {
      username: null,
      cleanText: trimmed
    };
  }

  const username = match[1];

  // Remove the @username part and trim the remaining text
  const cleanText = trimmed
    .substring(match[0].length)
    .trim();

  return {
    username,
    cleanText
  };
}

/**
 * Find kid by username in household
 */
export async function findKidByUsername(
  username: string,
  householdId: string,
  supabase: any
): Promise<{ id: string; display_name: string } | null> {
  const { data, error } = await supabase
    .from('kids')
    .select('id, display_name')
    .eq('household_id', householdId)
    .ilike('username', username) // Case-insensitive match
    .single();

  if (error) {
    console.error('Error finding kid:', error);
    return null;
  }

  return data;
}

/**
 * Get all kids in household (for clarification prompt)
 */
export async function getHouseholdKids(
  householdId: string,
  supabase: any
): Promise<Array<{ id: string; username: string; display_name: string }>> {
  const { data, error } = await supabase
    .from('kids')
    .select('id, username, display_name')
    .eq('household_id', householdId)
    .order('username');

  if (error) {
    console.error('Error fetching household kids:', error);
    return [];
  }

  return data || [];
}

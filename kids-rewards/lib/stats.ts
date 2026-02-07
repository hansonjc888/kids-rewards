/**
 * Stats and Leaderboard Queries
 */

import { supabaseAdmin } from './supabase';

export interface KidStats {
  kid_id: string;
  display_name: string;
  username: string;
  total_stars: number;
  submission_count: number;
  approved_count: number;
  pending_count: number;
}

export interface LeaderboardEntry {
  display_name: string;
  username: string;
  total_stars: number;
  rank: number;
}

export interface RecentSubmission {
  id: string;
  llm_summary: string;
  llm_story: string;
  category: string;
  stars: number | null;
  status: string;
  created_at: string;
}

/**
 * Get stats for a specific kid
 */
export async function getKidStats(householdId: string, username: string): Promise<KidStats | null> {
  // Get kid info
  const { data: kid, error: kidError } = await supabaseAdmin
    .from('kids')
    .select('id, display_name, username')
    .eq('household_id', householdId)
    .ilike('username', username)
    .single();

  if (kidError || !kid) {
    return null;
  }

  // Get total stars from ledger
  const { data: ledger } = await supabaseAdmin
    .from('points_ledger')
    .select('delta_points')
    .eq('kid_id', kid.id);

  const total_stars = ledger?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;

  // Get submission counts
  const { count: totalCount } = await supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('kid_id', kid.id);

  const { count: approvedCount } = await supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('kid_id', kid.id)
    .eq('status', 'approved');

  const { count: pendingCount } = await supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('kid_id', kid.id)
    .eq('status', 'pending_review');

  return {
    kid_id: kid.id,
    display_name: kid.display_name,
    username: kid.username,
    total_stars: total_stars,
    submission_count: totalCount || 0,
    approved_count: approvedCount || 0,
    pending_count: pendingCount || 0
  };
}

/**
 * Get leaderboard for all kids in household
 */
export async function getLeaderboard(householdId: string): Promise<LeaderboardEntry[]> {
  // Get all kids
  const { data: kids } = await supabaseAdmin
    .from('kids')
    .select('id, display_name, username')
    .eq('household_id', householdId)
    .order('display_name');

  if (!kids) return [];

  // Get stars for each kid
  const leaderboard = await Promise.all(
    kids.map(async (kid) => {
      const { data: ledger } = await supabaseAdmin
        .from('points_ledger')
        .select('delta_points')
        .eq('kid_id', kid.id);

      const total_stars = ledger?.reduce((sum, entry) => sum + entry.delta_points, 0) || 0;

      return {
        display_name: kid.display_name,
        username: kid.username,
        total_stars
      };
    })
  );

  // Sort by stars (descending) and add rank
  leaderboard.sort((a, b) => b.total_stars - a.total_stars);

  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

/**
 * Get recent submissions for a kid
 */
export async function getRecentSubmissions(
  householdId: string,
  username: string,
  limit: number = 10
): Promise<RecentSubmission[]> {
  // Get kid info
  const { data: kid } = await supabaseAdmin
    .from('kids')
    .select('id')
    .eq('household_id', householdId)
    .ilike('username', username)
    .single();

  if (!kid) return [];

  // Get submissions with approval info
  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select(`
      id,
      llm_summary,
      llm_story,
      category,
      status,
      created_at,
      approvals (stars)
    `)
    .eq('kid_id', kid.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!submissions) return [];

  return submissions.map((sub: any) => ({
    id: sub.id,
    llm_summary: sub.llm_summary,
    llm_story: sub.llm_story,
    category: sub.category,
    stars: sub.approvals?.[0]?.stars || null,
    status: sub.status,
    created_at: sub.created_at
  }));
}

/**
 * Get today's summary for parent
 */
export async function getTodaySummary(householdId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: submissions } = await supabaseAdmin
    .from('submissions')
    .select(`
      id,
      status,
      kids (display_name),
      approvals (stars)
    `)
    .eq('household_id', householdId)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false });

  if (!submissions) return null;

  const totalSubmissions = submissions.length;
  const approvedCount = submissions.filter((s: any) => s.status === 'approved').length;
  const pendingCount = submissions.filter((s: any) => s.status === 'pending_review').length;
  const totalStarsAwarded = submissions.reduce((sum: number, s: any) => {
    return sum + (s.approvals?.[0]?.stars || 0);
  }, 0);

  return {
    totalSubmissions,
    approvedCount,
    pendingCount,
    totalStarsAwarded,
    submissions
  };
}

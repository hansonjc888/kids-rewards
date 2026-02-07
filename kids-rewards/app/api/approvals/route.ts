import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { handleApproval, handleRejection } from '@/lib/submission-handler';
import { getTelegramProvider } from '@/lib/messaging';
import type { TelegramProvider } from '@/lib/messaging/telegram';

/**
 * POST /api/approvals
 *
 * Approve or reject a submission from the web dashboard.
 * Uses the authenticated parent's user ID.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submission_id, stars, action } = body;

    if (!submission_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: submission_id, action' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'approve' && (!stars || stars < 1 || stars > 3)) {
      return NextResponse.json(
        { error: 'stars must be between 1 and 3 for approval' },
        { status: 400 }
      );
    }

    // Get Telegram provider for kid notification (optional)
    let telegram: TelegramProvider | undefined;
    try {
      telegram = getTelegramProvider() as TelegramProvider;
    } catch {
      console.warn('Telegram not configured — kid will not be notified via chat');
    }

    // Use the authenticated parent's user ID
    const parentUserId = user.id;

    if (action === 'approve') {
      const result = await handleApproval(submission_id, stars, parentUserId, telegram);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: `Approved with ${stars} stars` });
    } else {
      const result = await handleRejection(submission_id, parentUserId, telegram);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'Submission rejected' });
    }
  } catch (error) {
    console.error('Approval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

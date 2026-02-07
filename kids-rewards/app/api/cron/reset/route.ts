import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { performReset } from '@/lib/reset';

/**
 * GET /api/cron/reset
 *
 * Auto-reset endpoint called by an external cron job.
 * Secured by CRON_SECRET query param.
 *
 * Checks all households with monthly/yearly reset schedule
 * and performs reset if the period has elapsed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: households } = await supabaseAdmin
    .from('households')
    .select('id, settings');

  if (!households) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const household of households) {
    const settings = household.settings || {};
    const schedule = settings.reset_schedule;

    if (!schedule || schedule === 'none') continue;

    const lastReset = settings.last_reset_at ? new Date(settings.last_reset_at) : null;
    const now = new Date();

    let shouldReset = false;

    if (schedule === 'monthly') {
      if (!lastReset) {
        shouldReset = true;
      } else {
        // Reset if we're in a different month
        shouldReset =
          lastReset.getFullYear() !== now.getFullYear() ||
          lastReset.getMonth() !== now.getMonth();
      }
    } else if (schedule === 'yearly') {
      if (!lastReset) {
        shouldReset = true;
      } else {
        shouldReset = lastReset.getFullYear() !== now.getFullYear();
      }
    }

    if (shouldReset) {
      const triggeredBy = schedule === 'monthly' ? 'auto_monthly' : 'auto_yearly';
      await performReset(household.id, triggeredBy as 'auto_monthly' | 'auto_yearly');
      processed++;
    }
  }

  return NextResponse.json({ processed });
}

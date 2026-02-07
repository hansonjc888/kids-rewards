import { NextRequest, NextResponse } from 'next/server';
import { getTelegramProvider } from '@/lib/messaging';
import type { TelegramProvider } from '@/lib/messaging/telegram';
import {
  handleNewSubmission,
  handleCallbackQuery,
  handleCommand
} from '@/lib/submission-handler';

const COMMANDS = ['/help', '/mystats', '/history', '/leaderboard', '/summary', '/bonus', '/join', '/rewards', '/redeem'];

/**
 * POST /api/webhooks/telegram
 *
 * Telegram webhook handler — full submission + approval flow.
 * CRITICAL: Must respond within 2 seconds. Heavy processing is fire-and-forget.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log('📨 Telegram webhook:', JSON.stringify(payload, null, 2));

    const telegram = getTelegramProvider() as TelegramProvider;

    // Handle callback queries (button presses) — these are approval/rejection actions
    if (payload.callback_query) {
      // Fire-and-forget: process asynchronously so we return 200 quickly
      handleCallbackQuery(payload.callback_query, telegram).catch((error) => {
        console.error('❌ Error handling callback query:', error);
      });

      return new NextResponse('OK', { status: 200 });
    }

    // Parse incoming messages
    const messages = telegram.parseWebhook(payload);

    if (messages.length === 0) {
      return new NextResponse('OK', { status: 200 });
    }

    // Process each message (fire-and-forget for async processing)
    for (const message of messages) {
      console.log(`📱 Telegram message from ${message.from}:`, message.text || '(no text)');

      const text = message.text || '';

      // Route commands
      const command = COMMANDS.find(cmd => text.startsWith(cmd));
      if (command) {
        handleCommand(command, message, telegram).catch((error) => {
          console.error(`❌ Error handling command ${command}:`, error);
          telegram.sendMessage(message.from, `❌ Something went wrong. Please try again.`).catch(() => {});
        });
        continue;
      }

      // Unknown slash commands — hint to use /help
      if (text.startsWith('/')) {
        telegram.sendMessage(message.from, `Unknown command. Type /help to see available commands.`).catch(() => {});
        continue;
      }

      // Regular message or photo — process as submission
      handleNewSubmission(message, telegram).catch((error) => {
        console.error('❌ Error handling submission:', error);
        telegram.sendMessage(message.from, '❌ Something went wrong processing your submission. Please try again.').catch(() => {});
      });
    }

    // CRITICAL: Respond immediately to Telegram (< 2s)
    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Telegram webhook error:', error);
    // Still return 200 to avoid Telegram retries
    return new NextResponse('OK', { status: 200 });
  }
}

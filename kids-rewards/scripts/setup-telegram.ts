/**
 * Setup Telegram Webhook
 *
 * Usage:
 *   npx tsx scripts/setup-telegram.ts <webhook_url>
 *
 * Example:
 *   npx tsx scripts/setup-telegram.ts https://abc123.ngrok-free.app/api/webhooks/telegram
 */

import { getTelegramProvider } from '../lib/messaging';

async function main() {
  const webhookUrl = process.argv[2];

  if (!webhookUrl) {
    console.error('❌ Error: Webhook URL is required');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/setup-telegram.ts <webhook_url>');
    console.log('\nExample:');
    console.log('  npx tsx scripts/setup-telegram.ts https://abc123.ngrok-free.app/api/webhooks/telegram');
    process.exit(1);
  }

  if (!webhookUrl.startsWith('https://')) {
    console.error('❌ Error: Webhook URL must start with https://');
    process.exit(1);
  }

  if (!webhookUrl.endsWith('/api/webhooks/telegram')) {
    console.warn('⚠️  Warning: URL should end with /api/webhooks/telegram');
  }

  try {
    console.log('🔧 Setting up Telegram webhook...');
    console.log(`📍 URL: ${webhookUrl}`);

    const telegram = getTelegramProvider();

    // Get bot info
    const botInfo = await telegram.getMe();
    console.log(`🤖 Bot: @${botInfo.username} (${botInfo.first_name})`);

    // Set webhook
    await telegram.setWebhook(webhookUrl);

    console.log('\n✅ Telegram webhook configured successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Keep ngrok running');
    console.log(`3. Send a message to @${botInfo.username} on Telegram`);
    console.log('4. Check your server logs for incoming messages');

  } catch (error: any) {
    console.error('\n❌ Failed to set up webhook:');
    console.error(error.message || error);
    process.exit(1);
  }
}

main();

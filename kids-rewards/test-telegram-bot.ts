/**
 * Test Telegram Bot with Polling (No webhook needed!)
 *
 * Run: TELEGRAM_BOT_TOKEN=your_token npx tsx test-telegram-bot.ts
 * Or: npm run test-bot
 */

import TelegramBot from 'node-telegram-bot-api';
import { parseIdentity } from './lib/identity';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Create bot with polling
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot is starting...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';

  console.log(`\n📨 Message from ${msg.from?.first_name || 'Unknown'} (${chatId}):`);
  console.log(`   Text: ${text}`);

  // Test identity parsing
  const { username, cleanText } = parseIdentity(text);

  if (username) {
    console.log(`   ✅ Identity: @${username}`);
    console.log(`   Clean text: ${cleanText}`);
  } else {
    console.log(`   ⚠️  No identity found`);
  }

  // Echo response (same as Phase 1 webhook)
  let response = `You said: "${text}"\n\n✅ Message received!\nPlatform: Telegram\nMessageID: ${msg.message_id}`;

  if (username) {
    response += `\n\n🎯 Identity detected: @${username}\nMessage: ${cleanText}`;
  }

  if (msg.photo) {
    response += `\n📸 Photo detected (${msg.photo.length} sizes)`;
  }

  await bot.sendMessage(chatId, response);
  console.log('   ✅ Response sent\n');
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

// Get bot info
bot.getMe().then((me) => {
  console.log(`✅ Bot started successfully!`);
  console.log(`   Username: @${me.username}`);
  console.log(`   Name: ${me.first_name}`);
  console.log(`\n📱 Send a message to @${me.username} on Telegram to test!\n`);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

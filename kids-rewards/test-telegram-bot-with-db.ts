/**
 * Test Telegram Bot with Database Storage (Phase 2)
 *
 * Run: npm run test-bot-db
 */

import TelegramBot from 'node-telegram-bot-api';
import { parseIdentity } from './lib/identity';
import { supabaseAdmin } from './lib/supabase';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Get household ID (assuming single household for now)
let householdId: string;

async function init() {
  const { data: households } = await supabaseAdmin
    .from('households')
    .select('id')
    .limit(1)
    .single();

  if (!households) {
    console.error('❌ No household found in database');
    process.exit(1);
  }

  householdId = households.id;
  console.log(`✅ Using household: ${householdId}`);
}

// Create bot with polling
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot is starting...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';
  const messageId = msg.message_id;

  console.log(`\n📨 Message from ${msg.from?.first_name || 'Unknown'} (${chatId}):`);
  console.log(`   Text: ${text}`);

  // Parse identity
  const { username, cleanText } = parseIdentity(text);

  if (username) {
    console.log(`   ✅ Identity: @${username}`);
    console.log(`   Clean text: ${cleanText}`);

    // Look up kid in database
    const { data: kid, error: kidError } = await supabaseAdmin
      .from('kids')
      .select('id, display_name')
      .eq('household_id', householdId)
      .ilike('username', username)
      .single();

    if (kidError || !kid) {
      console.log(`   ❌ Kid not found: @${username}`);
      await bot.sendMessage(
        chatId,
        `❌ Unknown kid: @${username}\n\nAvailable: @alice, @bob, @jojo, @jasper`
      );
      return;
    }

    console.log(`   ✅ Kid found: ${kid.display_name} (${kid.id})`);

    // Store submission in database
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({
        kid_id: kid.id,
        household_id: householdId,
        platform: 'telegram',
        platform_message_id: messageId.toString(),
        platform_user_id: chatId.toString(),
        original_text: cleanText || username,
        status: 'pending_review',
        identity_source: 'explicit_at'
      })
      .select()
      .single();

    if (subError) {
      console.error('   ❌ Error storing submission:', subError);

      // Check if duplicate
      if (subError.code === '23505') {
        await bot.sendMessage(chatId, '⚠️ Already received this message!');
        return;
      }

      await bot.sendMessage(chatId, '❌ Error storing submission');
      return;
    }

    console.log(`   ✅ Submission stored: ${submission.id}`);

    // Send success response
    const response = `✅ Got it, ${kid.display_name}!

📝 "${cleanText || '(no message)'}"

✨ Submission ID: ${submission.id.substring(0, 8)}
⏳ Status: Pending parent review

Your submission has been saved to the database!`;

    await bot.sendMessage(chatId, response);

  } else {
    // No identity found
    console.log(`   ⚠️  No identity found`);

    // Store as pending_identity
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({
        kid_id: null,  // No kid yet
        household_id: householdId,
        platform: 'telegram',
        platform_message_id: messageId.toString(),
        platform_user_id: chatId.toString(),
        original_text: text,
        status: 'pending_identity',
        identity_source: null
      })
      .select()
      .single();

    if (subError) {
      console.error('   ❌ Error storing pending submission:', subError);
      return;
    }

    console.log(`   ✅ Stored as pending_identity: ${submission.id}`);

    // Ask for clarification
    await bot.sendMessage(
      chatId,
      `⚠️ Who is this?

Please start your message with @name:
• @alice
• @bob
• @jojo
• @jasper

Example: @alice Read 20 pages`
    );
  }

  console.log('   ✅ Response sent\n');
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

// Initialize and start
init().then(() => {
  bot.getMe().then((me) => {
    console.log(`✅ Bot started successfully!`);
    console.log(`   Username: @${me.username}`);
    console.log(`   Name: ${me.first_name}`);
    console.log(`\n📱 Send a message to @${me.username} on Telegram to test!\n`);
    console.log(`💡 Try: @alice Read 20 pages\n`);
  });
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

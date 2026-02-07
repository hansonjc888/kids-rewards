/**
 * Phase 3: Bot with LLM Processing & Parent Notifications
 *
 * Run: npm run test-bot-phase3
 */

import TelegramBot from 'node-telegram-bot-api';
import { parseIdentity } from './lib/identity';
import { supabaseAdmin } from './lib/supabase';
import { analyzeSubmission } from './lib/llm';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Get household ID (assuming single household for now)
let householdId: string;

// For now, parent is the same chat (in production, this would be a different user)
const PARENT_CHAT_ID = process.env.PARENT_CHAT_ID || null;

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

    // Send immediate acknowledgment
    await bot.sendMessage(chatId, `✅ Got it, ${kid.display_name}! Processing your submission...`);

    // Run LLM analysis
    console.log(`   🤖 Analyzing with Gemini...`);
    const analysis = await analyzeSubmission(cleanText || username);
    console.log(`   ✅ LLM Result:`, analysis);

    // Store submission in database with LLM results
    const { data: submission, error: subError } = await supabaseAdmin
      .from('submissions')
      .insert({
        kid_id: kid.id,
        household_id: householdId,
        platform: 'telegram',
        platform_message_id: messageId.toString(),
        platform_user_id: chatId.toString(),
        original_text: cleanText || username,
        llm_summary: analysis.summary,
        category: analysis.category,
        tags: analysis.tags,
        confidence: analysis.confidence,
        status: analysis.needs_parent_review ? 'pending_review' : 'pending_review', // All need parent review for now
        identity_source: 'explicit_at'
      })
      .select()
      .single();

    if (subError) {
      console.error('   ❌ Error storing submission:', subError);

      if (subError.code === '23505') {
        await bot.sendMessage(chatId, '⚠️ Already received this message!');
        return;
      }

      await bot.sendMessage(chatId, '❌ Error storing submission');
      return;
    }

    console.log(`   ✅ Submission stored: ${submission.id}`);

    // Send confirmation to kid
    await bot.sendMessage(chatId,
`🎉 Submission received!

📝 Summary: ${analysis.summary}
📂 Category: ${analysis.category}
⭐ Suggested: ${'⭐'.repeat(analysis.suggested_stars)}
🆔 ID: ${submission.id.substring(0, 8)}

⏳ Waiting for parent approval...`
    );

    // Send notification to parent
    const parentChatId = PARENT_CHAT_ID || chatId; // For testing, send to same chat

    console.log(`   📬 Notifying parent...`);

    const notificationText = `🎯 New achievement from ${kid.display_name}!

📝 "${analysis.summary}"

📂 Category: ${analysis.category}
🏷️ Tags: ${analysis.tags.join(', ')}
⭐ Suggested: ${analysis.suggested_stars} star${analysis.suggested_stars > 1 ? 's' : ''}
💯 Confidence: ${(analysis.confidence * 100).toFixed(0)}%
${analysis.needs_parent_review ? '\n⚠️ Needs review' : ''}

Original: "${cleanText || username}"`;

    await bot.sendMessage(parentChatId, notificationText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⭐ 1', callback_data: `approve:${submission.id}:1` },
            { text: '⭐⭐ 2', callback_data: `approve:${submission.id}:2` },
            { text: '⭐⭐⭐ 3', callback_data: `approve:${submission.id}:3` }
          ],
          [
            { text: '❌ Reject', callback_data: `reject:${submission.id}` }
          ]
        ]
      }
    });

    console.log(`   ✅ Parent notified\n`);

  } else {
    // No identity found
    console.log(`   ⚠️  No identity found`);

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
});

// Handle approval buttons
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const data = query.data;

  if (!chatId || !data) return;

  console.log(`\n🔘 Button pressed: ${data}`);

  const [action, submissionId, starsStr] = data.split(':');
  const stars = parseInt(starsStr || '0');

  // Get submission
  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('*, kids(display_name, username)')
    .eq('id', submissionId)
    .single();

  if (!submission) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Submission not found' });
    return;
  }

  const kid = submission.kids as any;

  if (action === 'approve') {
    console.log(`   ✅ Approving with ${stars} stars`);

    // Record approval
    await supabaseAdmin
      .from('approvals')
      .insert({
        submission_id: submissionId,
        parent_user_id: chatId.toString(),
        stars: stars,
        comment: null
      });

    // Update submission status
    await supabaseAdmin
      .from('submissions')
      .update({ status: 'approved' })
      .eq('id', submissionId);

    // Write to points ledger
    await supabaseAdmin
      .from('points_ledger')
      .insert({
        kid_id: submission.kid_id,
        delta_points: stars,
        reason: `Approved submission: ${submission.llm_summary}`,
        submission_id: submissionId
      });

    // Update the parent message
    await bot.editMessageText(
      `✅ APPROVED: ${stars} star${stars > 1 ? 's' : ''}

${query.message?.text}

Approved by parent at ${new Date().toLocaleTimeString()}`,
      {
        chat_id: chatId,
        message_id: messageId
      }
    );

    // Notify kid
    await bot.sendMessage(
      submission.platform_user_id,
      `🎉 Your submission was approved!

📝 ${submission.llm_summary}
⭐ You earned: ${'⭐'.repeat(stars)}

Great job, ${kid.display_name}! 🌟`
    );

    await bot.answerCallbackQuery(query.id, { text: `✅ Approved with ${stars} stars!` });

  } else if (action === 'reject') {
    console.log(`   ❌ Rejecting`);

    // Update submission status
    await supabaseAdmin
      .from('submissions')
      .update({ status: 'rejected' })
      .eq('id', submissionId);

    // Update the parent message
    await bot.editMessageText(
      `❌ REJECTED

${query.message?.text}

Rejected at ${new Date().toLocaleTimeString()}`,
      {
        chat_id: chatId,
        message_id: messageId
      }
    );

    // Notify kid
    await bot.sendMessage(
      submission.platform_user_id,
      `❌ Your submission needs more work.

📝 ${submission.llm_summary}

Please try again with more details or a different achievement!`
    );

    await bot.answerCallbackQuery(query.id, { text: '❌ Rejected' });
  }

  console.log(`   ✅ Done\n`);
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
    console.log(`💡 Try: @alice Read 20 pages of Harry Potter\n`);
  });
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

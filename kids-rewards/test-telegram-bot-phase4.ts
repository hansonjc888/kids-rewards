/**
 * Phase 4: Bot with Story Generation & Image Support
 *
 * New features:
 * - LLM generates engaging stories (not just summaries)
 * - Support for image uploads
 * - Parents see both story and image for approval
 *
 * Run: npm run test-bot-phase4
 */

import TelegramBot from 'node-telegram-bot-api';
import { parseIdentity } from './lib/identity';
import { supabaseAdmin } from './lib/supabase';
import { analyzeSubmission } from './lib/llm';
import { uploadImage, checkBucketExists } from './lib/supabase-storage';
import { getParentContactsForKid } from './lib/parent-contacts';
import { mkdirSync, existsSync } from 'fs';
import {
  getKidStats,
  getLeaderboard,
  getRecentSubmissions,
  getTodaySummary
} from './lib/stats';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Get household ID
let householdId: string;

// Parent chat ID - should be different from kids' chat!
// To find parent's chat ID: send any message from parent's account and check logs
const PARENT_CHAT_ID = process.env.PARENT_CHAT_ID || null;

if (!PARENT_CHAT_ID) {
  console.warn('⚠️  PARENT_CHAT_ID not set - approval notifications will go to kid\'s chat!');
  console.warn('   To fix: Add PARENT_CHAT_ID=your_parent_chat_id to .env.local');
}

async function init() {
  // Create tmp directory for image downloads
  if (!existsSync('./tmp')) {
    mkdirSync('./tmp', { recursive: true });
  }

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

  // Check if storage bucket exists
  const bucketExists = await checkBucketExists();
  if (bucketExists) {
    console.log('✅ Supabase Storage configured - image uploads enabled');
  } else {
    console.log('⚠️ Storage bucket not found - create "submission-images" bucket in Supabase');
    console.log('   Image uploads will be disabled until bucket is created');
  }
}

// Create bot with polling
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot is starting...');

// Command: /mystats
bot.onText(/\/mystats/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  console.log(`\n📊 /mystats command from ${msg.from?.first_name}`);

  // Parse identity from message or look up by chat ID
  const { username } = parseIdentity(text.replace('/mystats', '').trim());

  if (!username) {
    await bot.sendMessage(chatId,
      `📊 Check Your Stats\n\nUsage: /mystats @yourname\n\nExample: /mystats @alice`
    );
    return;
  }

  const stats = await getKidStats(householdId, username);

  if (!stats) {
    await bot.sendMessage(chatId, `❌ Kid not found: @${username}`);
    return;
  }

  const message = `📊 Stats for ${stats.display_name}

⭐ Total Stars: ${stats.total_stars}
📝 Total Submissions: ${stats.submission_count}
✅ Approved: ${stats.approved_count}
⏳ Pending: ${stats.pending_count}

Keep up the great work! 🌟`;

  await bot.sendMessage(chatId, message);
  console.log(`   ✅ Sent stats for @${username}`);
});

// Command: /history
bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  console.log(`\n📜 /history command from ${msg.from?.first_name}`);

  const { username } = parseIdentity(text.replace('/history', '').trim());

  if (!username) {
    await bot.sendMessage(chatId,
      `📜 View Your History\n\nUsage: /history @yourname\n\nExample: /history @alice`
    );
    return;
  }

  const submissions = await getRecentSubmissions(householdId, username, 10);

  if (submissions.length === 0) {
    await bot.sendMessage(chatId, `No submissions found for @${username}`);
    return;
  }

  let message = `📜 Recent Submissions for @${username}\n\n`;

  submissions.forEach((sub, index) => {
    const statusEmoji = sub.status === 'approved' ? '✅' : sub.status === 'rejected' ? '❌' : '⏳';
    const starsText = sub.stars ? `${sub.stars}⭐` : '-';
    const date = new Date(sub.created_at).toLocaleDateString();

    message += `${index + 1}. ${statusEmoji} ${sub.llm_summary}\n`;
    message += `   ${sub.category} | ${starsText} | ${date}\n\n`;
  });

  await bot.sendMessage(chatId, message);
  console.log(`   ✅ Sent history for @${username}`);
});

// Command: /leaderboard
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;

  console.log(`\n🏆 /leaderboard command from ${msg.from?.first_name}`);

  const leaderboard = await getLeaderboard(householdId);

  if (leaderboard.length === 0) {
    await bot.sendMessage(chatId, `No data available yet!`);
    return;
  }

  let message = `🏆 Family Leaderboard\n\n`;

  leaderboard.forEach((entry) => {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
    message += `${medal} ${entry.rank}. ${entry.display_name}: ${entry.total_stars}⭐\n`;
  });

  message += `\nKeep earning stars! 🌟`;

  await bot.sendMessage(chatId, message);
  console.log(`   ✅ Sent leaderboard`);
});

// Command: /summary (parent only)
bot.onText(/\/summary/, async (msg) => {
  const chatId = msg.chat.id;

  console.log(`\n📋 /summary command from ${msg.from?.first_name}`);

  const summary = await getTodaySummary(householdId);

  if (!summary || summary.totalSubmissions === 0) {
    await bot.sendMessage(chatId, `📋 Today's Summary\n\nNo submissions yet today!`);
    return;
  }

  let message = `📋 Today's Summary\n\n`;
  message += `📝 Total Submissions: ${summary.totalSubmissions}\n`;
  message += `✅ Approved: ${summary.approvedCount}\n`;
  message += `⏳ Pending: ${summary.pendingCount}\n`;
  message += `⭐ Stars Awarded: ${summary.totalStarsAwarded}\n\n`;

  if (summary.submissions.length > 0) {
    message += `Recent activity:\n`;
    summary.submissions.slice(0, 5).forEach((sub: any) => {
      const statusEmoji = sub.status === 'approved' ? '✅' : '⏳';
      const kidName = sub.kids?.display_name || 'Unknown';
      message += `${statusEmoji} ${kidName}\n`;
    });
  }

  await bot.sendMessage(chatId, message);
  console.log(`   ✅ Sent summary`);
});

// Command: /bonus @kid stars reason (parent only)
bot.onText(/\/bonus/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  console.log(`\n🎁 /bonus command from ${msg.from?.first_name}`);

  // Parse: /bonus @kid 5 Great week!
  const match = text.match(/\/bonus\s+@(\w+)\s+(\d+)\s+(.+)/);

  if (!match) {
    await bot.sendMessage(chatId,
      `🎁 Award Bonus Stars\n\nUsage: /bonus @kid stars reason\n\nExample: /bonus @alice 5 Great week of reading!`
    );
    return;
  }

  const [, username, starsStr, reason] = match;
  const stars = parseInt(starsStr);

  if (stars < 1 || stars > 10) {
    await bot.sendMessage(chatId, `⚠️ Stars must be between 1 and 10`);
    return;
  }

  // Look up kid
  const { data: kid } = await supabaseAdmin
    .from('kids')
    .select('id, display_name')
    .eq('household_id', householdId)
    .ilike('username', username)
    .single();

  if (!kid) {
    await bot.sendMessage(chatId, `❌ Kid not found: @${username}`);
    return;
  }

  // Add to points ledger
  const { error } = await supabaseAdmin
    .from('points_ledger')
    .insert({
      kid_id: kid.id,
      delta_points: stars,
      reason: `Bonus: ${reason}`,
      submission_id: null
    });

  if (error) {
    console.error('   ❌ Error adding bonus:', error);
    await bot.sendMessage(chatId, `❌ Error awarding bonus`);
    return;
  }

  await bot.sendMessage(chatId,
    `🎁 Bonus awarded!\n\n${kid.display_name} earned ${stars}⭐\n\nReason: ${reason}`
  );

  console.log(`   ✅ Awarded ${stars} bonus stars to ${kid.display_name}`);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';
  const messageId = msg.message_id;
  const photo = msg.photo;

  // Skip command messages (they're handled by onText handlers)
  if (text.startsWith('/')) {
    return;
  }

  console.log(`\n📨 Message from ${msg.from?.first_name || 'Unknown'} (${chatId}):`);
  console.log(`   Text: ${text}`);
  if (photo) {
    console.log(`   📷 Photo attached (${photo.length} sizes)`);
  }

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

    // Handle image upload if present
    let imageUrl: string | undefined;
    let imageStoragePath: string | undefined;

    if (photo) {
      const bucketExists = await checkBucketExists();

      if (bucketExists) {
        try {
          console.log(`   📤 Uploading image to Supabase Storage...`);

          // Get largest photo
          const largestPhoto = photo[photo.length - 1];
          const fileId = largestPhoto.file_id;

          // Download from Telegram
          const filePath = await bot.downloadFile(fileId, './tmp');
          console.log(`   ✅ Downloaded from Telegram: ${filePath}`);

          // Read file buffer
          const fs = require('fs');
          const buffer = fs.readFileSync(filePath);

          // Upload to Supabase Storage
          const uploadResult = await uploadImage(buffer, 'image/jpeg', {
            kid_id: kid.id,
            kid_name: kid.display_name,
            telegram_file_id: fileId
          });

          imageUrl = uploadResult.publicUrl;
          imageStoragePath = uploadResult.path;

          console.log(`   ✅ Uploaded to Supabase: ${uploadResult.path}`);

          // Clean up temp file
          fs.unlinkSync(filePath);

        } catch (error) {
          console.error('   ❌ Error uploading image:', error);
          await bot.sendMessage(chatId, '⚠️ Image upload failed, but processing text...');
        }
      } else {
        console.log(`   ⚠️ Photo attached but storage bucket not found - skipping upload`);
        await bot.sendMessage(chatId, '⚠️ Image uploads not configured - processing text only...');
      }
    }

    // Run LLM analysis (with image URL if available)
    console.log(`   🤖 Analyzing with Gemini...`);
    const analysis = await analyzeSubmission(cleanText || username, imageUrl);
    console.log(`   ✅ LLM Result:`, analysis);

    // Store submission in database with LLM results and image
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
        llm_story: analysis.story,
        category: analysis.category,
        tags: analysis.tags,
        confidence: analysis.confidence,
        status: analysis.needs_parent_review ? 'pending_review' : 'pending_review',
        identity_source: 'explicit_at',
        image_url: imageUrl,
        image_s3_key: imageStoragePath
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

    // Send confirmation to kid with story
    await bot.sendMessage(chatId,
`🎉 Submission received!

📖 ${analysis.story}

📂 Category: ${analysis.category}
⭐ Suggested: ${'⭐'.repeat(analysis.suggested_stars)}
🆔 ID: ${submission.id.substring(0, 8)}

⏳ Waiting for parent approval...`
    );

    // Send notification to all assigned parents via DB lookup
    const parentChatIds = await getParentContactsForKid(kid.id, 'telegram');
    const notifyIds = parentChatIds.length > 0 ? parentChatIds : [chatId.toString()];

    console.log(`   📬 Notifying ${notifyIds.length} parent(s)...`);

    const notificationText = `🎯 New achievement from ${kid.display_name}!

📖 Story:
"${analysis.story}"

📝 Summary: ${analysis.summary}
📂 Category: ${analysis.category}
🏷️ Tags: ${analysis.tags.join(', ')}
⭐ Suggested: ${analysis.suggested_stars} star${analysis.suggested_stars > 1 ? 's' : ''}
💯 Confidence: ${(analysis.confidence * 100).toFixed(0)}%
${analysis.needs_parent_review ? '\n⚠️ Needs review' : ''}

Original: "${cleanText || username}"`;

    for (const parentChatId of notifyIds) {
      // Send image first if available
      if (imageUrl) {
        await bot.sendPhoto(parentChatId, imageUrl, {
          caption: `📷 Evidence from ${kid.display_name}`
        });
      }

      // Send notification with approval buttons
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
    }

    console.log(`   ✅ Parent(s) notified\n`);

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

Example: @alice Read 20 pages
You can also attach a photo for evidence!`
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

    // Notify kid with story
    await bot.sendMessage(
      submission.platform_user_id,
      `🎉 Your submission was approved!

📖 ${submission.llm_story}

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

📖 ${submission.llm_story}

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
    console.log(`💡 Try: @alice Read 20 pages of Harry Potter`);
    console.log(`💡 Or: @jojo Cleaned my room (with photo attached)`);
    console.log(`\n📊 Available Commands:`);
    console.log(`   /mystats @name - View your stats`);
    console.log(`   /history @name - View recent submissions`);
    console.log(`   /leaderboard - Family rankings`);
    console.log(`   /summary - Today's activity (parent)`);
    console.log(`   /bonus @kid stars reason - Award bonus (parent)\n`);
  });
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

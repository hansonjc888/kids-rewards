/**
 * Shared Submission Handler
 *
 * Extracted business logic for processing submissions, approvals, and rejections.
 * Used by both the Telegram webhook handler and web dashboard API.
 */

import { supabaseAdmin } from './supabase';
import { parseIdentity, getHouseholdKids } from './identity';
import { analyzeSubmission } from './llm';
import { uploadImage, checkBucketExists } from './supabase-storage';
import { getParentContactsForKid } from './parent-contacts';
import type { TelegramProvider } from './messaging/telegram';
import type { IncomingMessage, MessageButton } from './messaging/types';

/**
 * Resolve household ID from the sender's chat ID.
 *
 * Looks up parent_contacts to find which parent (and household) this chat belongs to.
 * Falls back to the first household in the database if no contact mapping exists
 * (backwards-compatible for single-family setups).
 */
export async function getHouseholdId(platform: string, platformUserId: string): Promise<string> {
  // 1. Try to resolve via chat_links (set by /join command)
  const { data: chatLink } = await supabaseAdmin
    .from('chat_links')
    .select('household_id')
    .eq('platform', platform)
    .eq('platform_chat_id', platformUserId)
    .limit(1)
    .single();

  if (chatLink) {
    return chatLink.household_id;
  }

  // 2. Try to resolve via parent_contacts → parents → household
  const { data: contact } = await supabaseAdmin
    .from('parent_contacts')
    .select('parent_id')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .limit(1)
    .single();

  if (contact) {
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('household_id')
      .eq('id', contact.parent_id)
      .single();

    if (parent) {
      return parent.household_id;
    }
  }

  // 3. Fallback: first household (backwards-compatible for single-family setups)
  const { data } = await supabaseAdmin
    .from('households')
    .select('id')
    .limit(1)
    .single();

  if (!data) {
    throw new Error('No household found in database');
  }

  return data.id;
}

/**
 * Handle a new submission message (text and/or image)
 *
 * This is the main entry point for processing kid submissions.
 * It handles identity parsing, image upload, LLM analysis, DB storage,
 * and parent notification.
 */
export async function handleNewSubmission(
  message: IncomingMessage,
  provider: TelegramProvider
): Promise<void> {
  const chatId = message.from;
  const text = message.text || '';
  const messageId = message.messageId;
  const hasImage = !!message.image;

  console.log(`\n📨 Processing submission from ${message.fromName} (${chatId})`);
  console.log(`   Text: ${text}`);
  if (hasImage) {
    console.log(`   📷 Image attached`);
  }

  const householdId = await getHouseholdId('telegram', chatId);

  // Parse identity
  const { username, cleanText } = parseIdentity(text);

  if (!username) {
    // No identity found — request clarification
    console.log(`   ⚠️ No identity found`);

    const kids = await getHouseholdKids(householdId, supabaseAdmin);
    const kidList = kids.map(k => `@${k.username}`).join('\n• ');

    await provider.sendMessage(
      chatId,
      `⚠️ Who is this?\n\nPlease start your message with @name:\n• ${kidList}\n\nExample: @alice Read 20 pages`
    );
    return;
  }

  console.log(`   ✅ Identity: @${username}`);

  // Look up kid in database
  const { data: kid, error: kidError } = await supabaseAdmin
    .from('kids')
    .select('id, display_name')
    .eq('household_id', householdId)
    .ilike('username', username)
    .single();

  if (kidError || !kid) {
    console.log(`   ❌ Kid not found: @${username}`);
    const kids = await getHouseholdKids(householdId, supabaseAdmin);
    const kidList = kids.map(k => `@${k.username}`).join(', ');
    await provider.sendMessage(chatId, `❌ Unknown kid: @${username}\n\nAvailable: ${kidList}`);
    return;
  }

  console.log(`   ✅ Kid found: ${kid.display_name} (${kid.id})`);

  // Check idempotency — skip if we already processed this message
  const { data: existing } = await supabaseAdmin
    .from('submissions')
    .select('id')
    .eq('platform_message_id', messageId)
    .eq('platform', 'telegram')
    .maybeSingle();

  if (existing) {
    console.log(`   ⚠️ Duplicate message ${messageId} — skipping`);
    return;
  }

  // Send immediate acknowledgment
  await provider.sendMessage(chatId, `✅ Got it, ${kid.display_name}! Processing your submission...`);

  // Handle image upload if present
  let imageUrl: string | undefined;
  let imageStoragePath: string | undefined;

  if (hasImage && message.image) {
    const bucketExists = await checkBucketExists();

    if (bucketExists) {
      try {
        console.log(`   📤 Uploading image...`);
        const buffer = await provider.downloadMedia(message.image.fileId);

        const uploadResult = await uploadImage(buffer, 'image/jpeg', {
          kid_id: kid.id,
          kid_name: kid.display_name,
          telegram_file_id: message.image.fileId
        });

        imageUrl = uploadResult.publicUrl;
        imageStoragePath = uploadResult.path;
        console.log(`   ✅ Image uploaded: ${uploadResult.path}`);
      } catch (error) {
        console.error('   ❌ Image upload error:', error);
        await provider.sendMessage(chatId, '⚠️ Image upload failed, but processing text...');
      }
    } else {
      console.log(`   ⚠️ Storage bucket not found — skipping image`);
    }
  }

  // Run LLM analysis
  console.log(`   🤖 Analyzing with Gemini...`);
  const analysis = await analyzeSubmission(cleanText || username, imageUrl);
  console.log(`   ✅ LLM Result:`, analysis);

  // Store submission in database
  const { data: submission, error: subError } = await supabaseAdmin
    .from('submissions')
    .insert({
      kid_id: kid.id,
      household_id: householdId,
      platform: 'telegram',
      platform_message_id: messageId,
      platform_user_id: chatId,
      original_text: cleanText || username,
      llm_summary: analysis.summary,
      llm_story: analysis.story,
      category: analysis.category,
      tags: analysis.tags,
      confidence: analysis.confidence,
      status: 'pending_review',
      identity_source: 'explicit_at',
      image_url: imageUrl,
      image_s3_key: imageStoragePath
    })
    .select()
    .single();

  if (subError) {
    console.error('   ❌ Error storing submission:', subError);

    if (subError.code === '23505') {
      await provider.sendMessage(chatId, '⚠️ Already received this message!');
      return;
    }

    await provider.sendMessage(chatId, '❌ Error storing submission');
    return;
  }

  console.log(`   ✅ Submission stored: ${submission.id}`);

  // Send confirmation to kid
  await provider.sendMessage(
    chatId,
    `🎉 Submission received!\n\n📖 ${analysis.story}\n\n📂 Category: ${analysis.category}\n⭐ Suggested: ${'⭐'.repeat(analysis.suggested_stars)}\n🆔 ID: ${submission.id.substring(0, 8)}\n\n⏳ Waiting for parent approval...`
  );

  // Notify all assigned parents via DB lookup (falls back to PARENT_CHAT_ID env var)
  const parentChatIds = await getParentContactsForKid(kid.id, 'telegram');

  // If no DB contacts and no env var, fall back to sender's chat
  const notifyIds = parentChatIds.length > 0 ? parentChatIds : [chatId];

  console.log(`   📬 Notifying ${notifyIds.length} parent(s)...`);

  const notificationText = `🎯 New achievement from ${kid.display_name}!\n\n📖 Story:\n"${analysis.story}"\n\n📝 Summary: ${analysis.summary}\n📂 Category: ${analysis.category}\n🏷️ Tags: ${analysis.tags.join(', ')}\n⭐ Suggested: ${analysis.suggested_stars} star${analysis.suggested_stars > 1 ? 's' : ''}\n💯 Confidence: ${(analysis.confidence * 100).toFixed(0)}%${analysis.needs_parent_review ? '\n\n⚠️ Needs review' : ''}\n\nOriginal: "${cleanText || username}"`;

  const starRow: MessageButton[] = [
    { id: `approve:${submission.id}:1`, label: '⭐ 1', data: `approve:${submission.id}:1` },
    { id: `approve:${submission.id}:2`, label: '⭐⭐ 2', data: `approve:${submission.id}:2` },
    { id: `approve:${submission.id}:3`, label: '⭐⭐⭐ 3', data: `approve:${submission.id}:3` },
  ];
  const rejectRow: MessageButton[] = [
    { id: `reject:${submission.id}`, label: '❌ Reject', data: `reject:${submission.id}` },
  ];

  for (const parentChatId of notifyIds) {
    // Send image first if available
    if (imageUrl) {
      await provider.sendImage(parentChatId, imageUrl, `📷 Evidence from ${kid.display_name}`);
    }

    await provider.sendMessageWithButtonRows(parentChatId, notificationText, [starRow, rejectRow]);
  }

  console.log(`   ✅ Parent(s) notified\n`);
}

/**
 * Handle approval of a submission
 */
export async function handleApproval(
  submissionId: string,
  stars: number,
  parentUserId: string,
  provider?: TelegramProvider
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n✅ Approving submission ${submissionId} with ${stars} stars`);

  // Validate stars
  if (stars < 1 || stars > 3) {
    return { success: false, error: 'Stars must be between 1 and 3' };
  }

  // Get submission with kid info
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('*, kids(display_name, username)')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submission) {
    return { success: false, error: 'Submission not found' };
  }

  if (submission.status === 'approved') {
    return { success: false, error: 'Submission already approved' };
  }

  const kid = submission.kids as any;

  // Record approval
  const { error: approvalError } = await supabaseAdmin
    .from('approvals')
    .insert({
      submission_id: submissionId,
      parent_user_id: parentUserId,
      stars: stars,
      comment: null
    });

  if (approvalError) {
    console.error('   ❌ Error recording approval:', approvalError);
    return { success: false, error: 'Failed to record approval' };
  }

  // Update submission status
  await supabaseAdmin
    .from('submissions')
    .update({ status: 'approved' })
    .eq('id', submissionId);

  // Write to points ledger (append-only)
  await supabaseAdmin
    .from('points_ledger')
    .insert({
      kid_id: submission.kid_id,
      delta_points: stars,
      reason: `Approved submission: ${submission.llm_summary}`,
      submission_id: submissionId
    });

  // Notify kid via Telegram if provider is available and we have their chat ID
  if (provider && submission.platform_user_id) {
    try {
      await provider.sendMessage(
        submission.platform_user_id,
        `🎉 Your submission was approved!\n\n📖 ${submission.llm_story}\n\n⭐ You earned: ${'⭐'.repeat(stars)}\n\nGreat job, ${kid.display_name}! 🌟`
      );
    } catch (error) {
      console.error('   ❌ Failed to notify kid:', error);
    }
  }

  console.log(`   ✅ Approved: ${kid.display_name} earned ${stars} stars\n`);
  return { success: true };
}

/**
 * Handle rejection of a submission
 */
export async function handleRejection(
  submissionId: string,
  parentUserId: string,
  provider?: TelegramProvider
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n❌ Rejecting submission ${submissionId}`);

  // Get submission with kid info
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('*, kids(display_name, username)')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submission) {
    return { success: false, error: 'Submission not found' };
  }

  if (submission.status === 'rejected') {
    return { success: false, error: 'Submission already rejected' };
  }

  // Update submission status
  await supabaseAdmin
    .from('submissions')
    .update({ status: 'rejected' })
    .eq('id', submissionId);

  const kid = submission.kids as any;

  // Notify kid via Telegram if provider is available
  if (provider && submission.platform_user_id) {
    try {
      await provider.sendMessage(
        submission.platform_user_id,
        `❌ Your submission needs more work.\n\n📖 ${submission.llm_story}\n\nPlease try again with more details or a different achievement!`
      );
    } catch (error) {
      console.error('   ❌ Failed to notify kid:', error);
    }
  }

  console.log(`   ✅ Rejected: ${kid.display_name}'s submission\n`);
  return { success: true };
}

/**
 * Handle a callback query (button press) from Telegram
 *
 * Parses the callback data and routes to approval/rejection handlers.
 * Also updates the parent's message and answers the callback query.
 */
export async function handleCallbackQuery(
  query: any,
  provider: TelegramProvider
): Promise<void> {
  const chatId = query.message?.chat?.id?.toString();
  const messageId = query.message?.message_id;
  const data = query.data;
  const queryId = query.id;

  if (!chatId || !data) return;

  console.log(`\n🔘 Button pressed: ${data}`);

  const parts = data.split(':');
  const action = parts[0];
  const submissionId = parts[1];
  const stars = parseInt(parts[2] || '0');

  if (action === 'approve' && submissionId) {
    const result = await handleApproval(submissionId, stars, chatId, provider);

    if (result.success) {
      // Update parent's message to show approval
      if (messageId) {
        await provider.editMessageText(
          chatId,
          messageId,
          `✅ APPROVED: ${stars} star${stars > 1 ? 's' : ''}\n\n${query.message?.text || ''}\n\nApproved at ${new Date().toLocaleTimeString()}`
        );
      }
      await provider.answerCallbackQuery(queryId, `✅ Approved with ${stars} stars!`);
    } else {
      await provider.answerCallbackQuery(queryId, `❌ ${result.error}`);
    }

  } else if (action === 'reject' && submissionId) {
    const result = await handleRejection(submissionId, chatId, provider);

    if (result.success) {
      if (messageId) {
        await provider.editMessageText(
          chatId,
          messageId,
          `❌ REJECTED\n\n${query.message?.text || ''}\n\nRejected at ${new Date().toLocaleTimeString()}`
        );
      }
      await provider.answerCallbackQuery(queryId, '❌ Rejected');
    } else {
      await provider.answerCallbackQuery(queryId, `❌ ${result.error}`);
    }

  } else if (action === 'redeem_approve') {
    const redemptionId = submissionId; // reusing parsed variable
    await handleRedemptionApproval(redemptionId, chatId, provider);
    await provider.answerCallbackQuery(queryId, '✅ Redemption approved!');
    if (messageId) {
      await provider.editMessageText(
        chatId,
        messageId,
        `✅ APPROVED\n\n${query.message?.text || ''}\n\nApproved at ${new Date().toLocaleTimeString()}`
      );
    }

  } else if (action === 'redeem_deny') {
    const redemptionId = submissionId;
    await handleRedemptionDenial(redemptionId, chatId, provider);
    await provider.answerCallbackQuery(queryId, '❌ Redemption denied');
    if (messageId) {
      await provider.editMessageText(
        chatId,
        messageId,
        `❌ DENIED\n\n${query.message?.text || ''}\n\nDenied at ${new Date().toLocaleTimeString()}`
      );
    }
  }
}

/**
 * Handle redemption approval from Telegram callback
 */
async function handleRedemptionApproval(
  redemptionId: string,
  parentChatId: string,
  provider: TelegramProvider
): Promise<void> {
  const { data: redemption } = await supabaseAdmin
    .from('redemptions')
    .select('*, kids(display_name)')
    .eq('id', redemptionId)
    .single();

  if (!redemption || redemption.status !== 'pending') return;

  // Re-check balance
  const { data: ledger } = await supabaseAdmin
    .from('points_ledger')
    .select('delta_points')
    .eq('kid_id', redemption.kid_id);

  const balance = ledger?.reduce((sum: number, e: any) => sum + e.delta_points, 0) || 0;

  if (balance < redemption.star_cost) {
    await provider.sendMessage(parentChatId, `❌ Cannot approve — ${(redemption.kids as any).display_name} only has ${balance}⭐ but needs ${redemption.star_cost}⭐.`);
    return;
  }

  // Deduct points
  await supabaseAdmin
    .from('points_ledger')
    .insert({
      kid_id: redemption.kid_id,
      delta_points: -redemption.star_cost,
      reason: `Redeemed: ${redemption.reward_name}`,
      submission_id: null,
    });

  // Update redemption
  await supabaseAdmin
    .from('redemptions')
    .update({
      status: 'approved',
      parent_user_id: parentChatId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', redemptionId);

  // Notify kid
  if (redemption.platform_chat_id) {
    await provider.sendMessage(
      redemption.platform_chat_id,
      `🎉 Your redemption was approved!\n\n🎁 ${redemption.reward_name} (${redemption.star_cost}⭐)\n\nEnjoy, ${(redemption.kids as any).display_name}!`
    );
  }
}

/**
 * Handle redemption denial from Telegram callback
 */
async function handleRedemptionDenial(
  redemptionId: string,
  parentChatId: string,
  provider: TelegramProvider
): Promise<void> {
  const { data: redemption } = await supabaseAdmin
    .from('redemptions')
    .select('*, kids(display_name)')
    .eq('id', redemptionId)
    .single();

  if (!redemption || redemption.status !== 'pending') return;

  await supabaseAdmin
    .from('redemptions')
    .update({
      status: 'denied',
      parent_user_id: parentChatId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', redemptionId);

  // Notify kid
  if (redemption.platform_chat_id) {
    await provider.sendMessage(
      redemption.platform_chat_id,
      `❌ Your redemption request was denied.\n\n🎁 ${redemption.reward_name} (${redemption.star_cost}⭐)\n\nTry again later, ${(redemption.kids as any).display_name}!`
    );
  }
}

/**
 * Handle bot commands (/mystats, /history, /leaderboard, /summary, /bonus)
 */
export async function handleCommand(
  command: string,
  message: IncomingMessage,
  provider: TelegramProvider
): Promise<void> {
  const chatId = message.from;
  const text = message.text || '';

  // Handle /join before resolving household — it's the command that creates the link
  if (command === '/join') {
    const code = text.replace('/join', '').trim().toUpperCase();

    if (!code) {
      await provider.sendMessage(chatId, `🔗 Join a Family\n\nUsage: /join <invite code>\n\nExample: /join ABC123\n\nAsk your parent for the invite code (found in Dashboard → Settings).`);
      return;
    }

    // Look up household by invite code
    const { data: household } = await supabaseAdmin
      .from('households')
      .select('id, name')
      .eq('settings->>invite_code', code)
      .single();

    if (!household) {
      await provider.sendMessage(chatId, `❌ Invalid invite code: ${code}\n\nPlease check the code and try again.`);
      return;
    }

    // Check if already linked
    const { data: existingLink } = await supabaseAdmin
      .from('chat_links')
      .select('household_id')
      .eq('platform', 'telegram')
      .eq('platform_chat_id', chatId)
      .single();

    if (existingLink && existingLink.household_id === household.id) {
      await provider.sendMessage(chatId, `ℹ️ This chat is already linked to "${household.name}".`);
      return;
    }

    // Upsert chat link
    const { error: linkError } = await supabaseAdmin
      .from('chat_links')
      .upsert({
        platform: 'telegram',
        platform_chat_id: chatId,
        household_id: household.id,
      }, { onConflict: 'platform,platform_chat_id' });

    if (linkError) {
      console.error('   ❌ Error linking chat:', linkError);
      await provider.sendMessage(chatId, `❌ Failed to link chat. Please try again.`);
      return;
    }

    await provider.sendMessage(chatId, `✅ Joined "${household.name}"!\n\nThis chat is now linked to your family. You can submit achievements using @yourname.`);
    return;
  }

  const householdId = await getHouseholdId('telegram', chatId);

  // Lazy import stats to avoid circular dependencies
  const { getKidStats, getLeaderboard, getRecentSubmissions, getTodaySummary } = await import('./stats');

  switch (command) {
    case '/help': {
      await provider.sendMessage(
        chatId,
        `📋 Available Commands\n\n` +
        `📝 Submit an achievement:\n` +
        `   @yourname Did something great!\n\n` +
        `📊 /mystats @yourname — View your stars and stats\n` +
        `📜 /history @yourname — See recent submissions\n` +
        `🏆 /leaderboard — Family rankings\n` +
        `📋 /summary — Today's activity\n` +
        `🎁 /rewards — View reward catalog\n` +
        `🎁 /redeem @yourname <reward> — Redeem stars for a reward\n` +
        `🎉 /bonus @kid stars reason — Award bonus stars (parents)\n` +
        `🔗 /join <code> — Link this chat to a family\n` +
        `❓ /help — Show this message`
      );
      break;
    }

    case '/mystats': {
      const { username } = parseIdentity(text.replace('/mystats', '').trim());

      if (!username) {
        await provider.sendMessage(chatId, `📊 Check Your Stats\n\nUsage: /mystats @yourname\n\nExample: /mystats @alice`);
        return;
      }

      const stats = await getKidStats(householdId, username);

      if (!stats) {
        await provider.sendMessage(chatId, `❌ Kid not found: @${username}`);
        return;
      }

      await provider.sendMessage(
        chatId,
        `📊 Stats for ${stats.display_name}\n\n⭐ Total Stars: ${stats.total_stars}\n📝 Total Submissions: ${stats.submission_count}\n✅ Approved: ${stats.approved_count}\n⏳ Pending: ${stats.pending_count}\n\nKeep up the great work! 🌟`
      );
      break;
    }

    case '/history': {
      const { username } = parseIdentity(text.replace('/history', '').trim());

      if (!username) {
        await provider.sendMessage(chatId, `📜 View Your History\n\nUsage: /history @yourname\n\nExample: /history @alice`);
        return;
      }

      const submissions = await getRecentSubmissions(householdId, username, 10);

      if (submissions.length === 0) {
        await provider.sendMessage(chatId, `No submissions found for @${username}`);
        return;
      }

      let msg = `📜 Recent Submissions for @${username}\n\n`;
      submissions.forEach((sub, index) => {
        const statusEmoji = sub.status === 'approved' ? '✅' : sub.status === 'rejected' ? '❌' : '⏳';
        const starsText = sub.stars ? `${sub.stars}⭐` : '-';
        const date = new Date(sub.created_at).toLocaleDateString();
        msg += `${index + 1}. ${statusEmoji} ${sub.llm_summary}\n   ${sub.category} | ${starsText} | ${date}\n\n`;
      });

      await provider.sendMessage(chatId, msg);
      break;
    }

    case '/leaderboard': {
      const leaderboard = await getLeaderboard(householdId);

      if (leaderboard.length === 0) {
        await provider.sendMessage(chatId, `No data available yet!`);
        return;
      }

      let msg = `🏆 Family Leaderboard\n\n`;
      leaderboard.forEach((entry) => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
        msg += `${medal} ${entry.rank}. ${entry.display_name}: ${entry.total_stars}⭐\n`;
      });
      msg += `\nKeep earning stars! 🌟`;

      await provider.sendMessage(chatId, msg);
      break;
    }

    case '/summary': {
      const summary = await getTodaySummary(householdId);

      if (!summary || summary.totalSubmissions === 0) {
        await provider.sendMessage(chatId, `📋 Today's Summary\n\nNo submissions yet today!`);
        return;
      }

      let msg = `📋 Today's Summary\n\n`;
      msg += `📝 Total Submissions: ${summary.totalSubmissions}\n`;
      msg += `✅ Approved: ${summary.approvedCount}\n`;
      msg += `⏳ Pending: ${summary.pendingCount}\n`;
      msg += `⭐ Stars Awarded: ${summary.totalStarsAwarded}\n\n`;

      if (summary.submissions.length > 0) {
        msg += `Recent activity:\n`;
        summary.submissions.slice(0, 5).forEach((sub: any) => {
          const statusEmoji = sub.status === 'approved' ? '✅' : '⏳';
          const kidName = sub.kids?.display_name || 'Unknown';
          msg += `${statusEmoji} ${kidName}\n`;
        });
      }

      await provider.sendMessage(chatId, msg);
      break;
    }

    case '/bonus': {
      const match = text.match(/\/bonus\s+@(\w+)\s+(\d+)\s+(.+)/);

      if (!match) {
        await provider.sendMessage(chatId, `🎁 Award Bonus Stars\n\nUsage: /bonus @kid stars reason\n\nExample: /bonus @alice 5 Great week of reading!`);
        return;
      }

      const [, bonusUsername, starsStr, reason] = match;
      const bonusStars = parseInt(starsStr);

      if (bonusStars < 1 || bonusStars > 10) {
        await provider.sendMessage(chatId, `⚠️ Stars must be between 1 and 10`);
        return;
      }

      const { data: kid } = await supabaseAdmin
        .from('kids')
        .select('id, display_name')
        .eq('household_id', householdId)
        .ilike('username', bonusUsername)
        .single();

      if (!kid) {
        await provider.sendMessage(chatId, `❌ Kid not found: @${bonusUsername}`);
        return;
      }

      const { error } = await supabaseAdmin
        .from('points_ledger')
        .insert({
          kid_id: kid.id,
          delta_points: bonusStars,
          reason: `Bonus: ${reason}`,
          submission_id: null
        });

      if (error) {
        console.error('   ❌ Error adding bonus:', error);
        await provider.sendMessage(chatId, `❌ Error awarding bonus`);
        return;
      }

      await provider.sendMessage(chatId, `🎁 Bonus awarded!\n\n${kid.display_name} earned ${bonusStars}⭐\n\nReason: ${reason}`);
      break;
    }

    case '/rewards': {
      const { data: rewards } = await supabaseAdmin
        .from('rewards')
        .select('name, description, star_cost')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('star_cost', { ascending: true });

      if (!rewards || rewards.length === 0) {
        await provider.sendMessage(chatId, `🎁 Rewards Catalog\n\nNo rewards available yet. Ask your parents to add some!`);
        return;
      }

      let msg = `🎁 Rewards Catalog\n\n`;
      rewards.forEach((r, i) => {
        msg += `${i + 1}. ${r.name}${r.description ? ` (${r.description})` : ''} — ${r.star_cost}⭐\n`;
      });
      msg += `\nTo redeem: /redeem @yourname <reward name>`;

      await provider.sendMessage(chatId, msg);
      break;
    }

    case '/redeem': {
      const redeemText = text.replace('/redeem', '').trim();
      const { username: redeemUsername, cleanText: rewardText } = parseIdentity(redeemText);

      if (!redeemUsername) {
        await provider.sendMessage(chatId, `🎁 Redeem a Reward\n\nUsage: /redeem @yourname <reward name>\n\nExample: /redeem @alice Screen Time`);
        return;
      }

      if (!rewardText || rewardText.trim().length === 0) {
        await provider.sendMessage(chatId, `⚠️ Please specify a reward name.\n\nUsage: /redeem @${redeemUsername} <reward name>\n\nType /rewards to see available rewards.`);
        return;
      }

      // Look up kid
      const { data: redeemKid } = await supabaseAdmin
        .from('kids')
        .select('id, display_name')
        .eq('household_id', householdId)
        .ilike('username', redeemUsername)
        .single();

      if (!redeemKid) {
        await provider.sendMessage(chatId, `❌ Kid not found: @${redeemUsername}`);
        return;
      }

      // Match reward (case-insensitive)
      const { data: rewards } = await supabaseAdmin
        .from('rewards')
        .select('id, name, description, star_cost')
        .eq('household_id', householdId)
        .eq('is_active', true);

      const matchedReward = rewards?.find(
        r => r.name.toLowerCase() === rewardText.trim().toLowerCase()
      );

      if (!matchedReward) {
        await provider.sendMessage(chatId, `❌ Reward not found: "${rewardText.trim()}"\n\nType /rewards to see available rewards.`);
        return;
      }

      // Check balance
      const { data: ledger } = await supabaseAdmin
        .from('points_ledger')
        .select('delta_points')
        .eq('kid_id', redeemKid.id);

      const balance = ledger?.reduce((sum, e) => sum + e.delta_points, 0) || 0;

      if (balance < matchedReward.star_cost) {
        await provider.sendMessage(chatId, `❌ Not enough stars!\n\n${redeemKid.display_name} has ${balance}⭐ but needs ${matchedReward.star_cost}⭐ for "${matchedReward.name}".`);
        return;
      }

      // Create redemption
      const { data: redemption, error: redeemError } = await supabaseAdmin
        .from('redemptions')
        .insert({
          kid_id: redeemKid.id,
          household_id: householdId,
          reward_id: matchedReward.id,
          reward_name: matchedReward.name,
          star_cost: matchedReward.star_cost,
          status: 'pending',
          platform_chat_id: chatId,
        })
        .select()
        .single();

      if (redeemError) {
        console.error('Error creating redemption:', redeemError);
        await provider.sendMessage(chatId, `❌ Error submitting redemption request.`);
        return;
      }

      await provider.sendMessage(chatId, `✅ Redemption request submitted!\n\n🎁 ${matchedReward.name} (${matchedReward.star_cost}⭐)\n👤 ${redeemKid.display_name}\n\n⏳ Waiting for parent approval...`);

      // Notify parents
      const parentChatIds = await getParentContactsForKid(redeemKid.id, 'telegram');
      const notifyIds = parentChatIds.length > 0 ? parentChatIds : [chatId];

      const approveRow: MessageButton[] = [
        { id: `redeem_approve:${redemption.id}`, label: '✅ Approve', data: `redeem_approve:${redemption.id}` },
        { id: `redeem_deny:${redemption.id}`, label: '❌ Deny', data: `redeem_deny:${redemption.id}` },
      ];

      for (const parentId of notifyIds) {
        await provider.sendMessageWithButtonRows(
          parentId,
          `🎁 Redemption Request\n\n👤 ${redeemKid.display_name} wants to redeem:\n🏆 ${matchedReward.name} (${matchedReward.star_cost}⭐)\n💰 Current balance: ${balance}⭐`,
          [approveRow]
        );
      }

      break;
    }
  }
}

# Setting Up Telegram Bot (Recommended for Testing)

## Why Telegram?

✅ **2-minute setup** - No business verification needed
✅ **Completely free** - Unlimited messages
✅ **Better for testing** - Instant, no approval process
✅ **Same features** - Images, buttons, everything WhatsApp has
✅ **Multi-device** - Works on phone, desktop, web simultaneously

## Step-by-Step Setup

### 1. Create Your Telegram Bot (2 minutes)

1. **Open Telegram** (on your phone or desktop)
2. **Search for** `@BotFather`
3. **Send** `/newbot`
4. **Follow the prompts:**
   - Choose a name (e.g., "Kids Rewards Bot")
   - Choose a username (must end in `bot`, e.g., `kids_rewards_bot`)

5. **Copy your bot token** - looks like:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### 2. Configure Environment

Edit `.env.local`:

```env
# Telegram Bot (Just add this line!)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Start Your Server

```bash
npm run dev
```

Server starts on http://localhost:3000

### 4. Expose with ngrok

In a **new terminal**:

```bash
ngrok http 3000
```

Copy the **https** URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Set Up Webhook

```bash
npx tsx scripts/setup-telegram.ts https://abc123.ngrok-free.app/api/webhooks/telegram
```

You should see:
```
✅ Telegram webhook configured successfully!
🤖 Bot: @kids_rewards_bot (Kids Rewards Bot)
```

### 6. Test It!

1. **Open Telegram**
2. **Search for your bot** (e.g., `@kids_rewards_bot`)
3. **Click "START"** or send any message:

```
Hello world!
```

You should get:
```
You said: "Hello world!"

✅ Message received!
Platform: Telegram
MessageID: 123
```

🎉 **That's it! Your bot is working!**

---

## Testing with Images

Send an image with a caption:

```
📸 (upload image with caption: "Test image")
```

You should get:
```
📸 Image received!
Caption: Test image
FileID: AgACAgIAAx...
```

---

## Common Issues

### "TELEGRAM_BOT_TOKEN is not set"

- Make sure you edited `.env.local` and added the token
- Restart the dev server after changing `.env.local`

### "Error: 409 Conflict: terminated by other getUpdates request"

- Your bot is set to polling mode somewhere else
- Run: `npx tsx scripts/setup-telegram.ts <your-url>` again

### Bot doesn't respond

- Check dev server logs in terminal
- Make sure ngrok is still running
- Verify webhook URL is correct
- Send `/start` to your bot first

### ngrok URL changed

When ngrok restarts, you get a new URL. Run setup again:
```bash
npx tsx scripts/setup-telegram.ts https://NEW-URL.ngrok-free.app/api/webhooks/telegram
```

---

## Testing Phase 1 Features

### ✅ Text Messages
```
Send: Hello!
Get: You said: "Hello!" ✅ Message received!
```

### ✅ Images with Captions
```
Send: 📸 + caption "Test"
Get: 📸 Image received! Caption: Test
```

### ✅ Identity Parsing (Ready for Phase 2)
```
Send: @Alice Read 20 pages
(Will parse @Alice correctly in Phase 2)
```

---

## Advantages Over WhatsApp

| Feature | Telegram | WhatsApp |
|---------|----------|----------|
| Setup time | 2 minutes | 30+ minutes |
| Approval needed | No | Yes (business) |
| Testing | Instant | Need verified number |
| Cost | Free forever | Free tier limited |
| Multi-device | Yes | Limited |
| Bot features | Excellent | Basic |
| Inline keyboards | Yes | Limited to 3 buttons |

---

## Next Steps

Once Telegram echo bot works:

1. ✅ Phase 1 complete!
2. Move to Phase 2: Identity resolution + database
3. You can add WhatsApp later - same code works for both!

---

## Useful Commands

**View Telegram bot info:**
```bash
npx tsx -e "import {getTelegramProvider} from './lib/messaging'; getTelegramProvider().getMe().then(console.log)"
```

**Delete webhook (if needed):**
```bash
npx tsx -e "import {getTelegramProvider} from './lib/messaging'; getTelegramProvider().deleteWebhook().then(() => console.log('Webhook deleted'))"
```

**Check server logs:**
- Watch terminal running `npm run dev`
- Look for `📨 Telegram webhook:` messages

---

## Pro Tips

💡 **Use Telegram Desktop** - Easier for testing than phone

💡 **Multiple test accounts** - Create multiple bots for different kids

💡 **Instant updates** - No need to restart anything when testing

💡 **Better debugging** - Telegram errors are clearer than WhatsApp

💡 **Groups support** - Can add bot to a family group chat

---

Ready to test? Send a message to your bot! 🚀

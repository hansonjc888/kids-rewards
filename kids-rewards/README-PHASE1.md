# Kids Rewards System - Phase 1: WhatsApp Echo Bot

## Current Status: Phase 1 Complete ✅

WhatsApp webhook is set up and working as an echo bot.

## What Works Now

- ✅ WhatsApp webhook verification (GET endpoint)
- ✅ Receive text messages from WhatsApp
- ✅ Receive images with captions
- ✅ Echo back messages to confirm receipt
- ✅ Proper response time (< 2 seconds)

## Setup Instructions

### 1. Configure Environment Variables

Edit `.env.local` and fill in your actual values:

```env
# WhatsApp Business API (REQUIRED for Phase 1)
WHATSAPP_PHONE_NUMBER_ID=your_actual_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_actual_access_token
WHATSAPP_VERIFY_TOKEN=mysecretverifytoken123  # You choose this

# Other variables can wait for later phases
```

### 2. Start Development Server

```bash
npm run dev
```

Server will start on http://localhost:3000

### 3. Expose Webhook with ngrok

In a separate terminal:

```bash
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

### 4. Configure WhatsApp Webhook

1. Go to Meta Developer Portal: https://developers.facebook.com/apps
2. Select your app → WhatsApp → Configuration
3. Set Webhook URL: `https://abc123.ngrok.io/api/webhooks/whatsapp`
4. Set Verify Token: Same as `WHATSAPP_VERIFY_TOKEN` in .env.local
5. Click "Verify and Save"
6. Subscribe to webhook fields: `messages`

### 5. Test the Bot

Send a message from your test WhatsApp number:

```
Hello world!
```

You should get back:

```
You said: "Hello world!"

✅ Message received!
MessageID: wamid.xxx...
```

Send an image with caption:

```
📸 (upload image with caption: "Test image")
```

You should get back:

```
📸 Image received!
Caption: Test image
ImageID: xxx...
```

## Project Structure

```
kids-rewards/
├── app/
│   └── api/
│       └── webhooks/
│           └── whatsapp/
│               └── route.ts         ✅ Webhook handler
├── lib/
│   ├── whatsapp.ts                  ✅ WhatsApp helpers
│   ├── identity.ts                  ✅ @name parser (ready for Phase 2)
│   └── supabase.ts                  ⏳ (for Phase 2)
├── types/
│   └── database.ts                  ✅ TypeScript types
└── .env.local                       ✅ Environment config
```

## Testing Checklist

- [ ] Webhook verification works (green checkmark in Meta dashboard)
- [ ] Text message gets echoed back
- [ ] Image message gets acknowledged
- [ ] Response arrives within 2 seconds
- [ ] ngrok tunnel stays open without disconnecting

## Common Issues

### Webhook verification fails

- Check `WHATSAPP_VERIFY_TOKEN` matches in both .env.local and Meta dashboard
- Make sure ngrok is running
- Check dev server is running on port 3000

### Messages not arriving

- Check webhook subscription in Meta dashboard
- Look at server logs: Check terminal running `npm run dev`
- Check ngrok logs: Visit http://localhost:4040
- Verify phone number is registered as test number in Meta dashboard

### "Missing WhatsApp credentials" error

- Make sure `.env.local` has actual values (not "your_*")
- Restart dev server after changing .env.local

## Logs to Watch

Terminal running `npm run dev`:
```
📨 Incoming webhook: {...}
📱 Message from +1234567890: {...}
✅ Webhook verified
```

## Next Steps (Phase 2)

Once Phase 1 is working:

1. Set up Supabase database
2. Create database tables
3. Implement @name identity parsing
4. Store submissions in database
5. Handle missing identity (clarification flow)

---

## Quick Reference

**Start dev server**: `npm run dev`
**Start ngrok**: `ngrok http 3000`
**View logs**: Check terminal
**View ngrok requests**: http://localhost:4040

**Webhook URL**: `https://YOUR-NGROK.ngrok.io/api/webhooks/whatsapp`

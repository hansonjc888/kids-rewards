# Multi-Platform Messaging Support

## Overview

The Kids Rewards system now supports **both Telegram and WhatsApp** through a unified messaging abstraction layer.

## Architecture

```
┌─────────────────────────────────────────────────┐
│         Messaging Abstraction Layer             │
│         (lib/messaging/)                        │
└─────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ↓                         ↓
┌──────────────┐          ┌──────────────┐
│   Telegram   │          │   WhatsApp   │
│   Provider   │          │   Provider   │
└──────────────┘          └──────────────┘
        │                         │
        ↓                         ↓
┌──────────────┐          ┌──────────────┐
│   Telegram   │          │   WhatsApp   │
│   Bot API    │          │ Business API │
└──────────────┘          └──────────────┘
```

## Code Structure

### Messaging Abstraction

All messaging platforms implement the same interface:

```typescript
interface MessagingProvider {
  readonly platform: 'telegram' | 'whatsapp';
  sendMessage(to: string, text: string): Promise<void>;
  sendMessageWithButtons(to: string, text: string, buttons: MessageButton[]): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  downloadMedia(fileId: string): Promise<Buffer>;
  parseWebhook(payload: any): IncomingMessage[];
}
```

### Unified Message Format

All incoming messages are converted to a standard format:

```typescript
interface IncomingMessage {
  messageId: string;
  from: string;              // User ID or phone number
  fromName?: string;          // Display name
  timestamp: number;
  text?: string;
  image?: { fileId: string; caption?: string; };
  platform: 'telegram' | 'whatsapp';
  raw: any;                  // Platform-specific data
}
```

## File Structure

```
lib/messaging/
├── types.ts           # Shared interfaces
├── telegram.ts        # Telegram implementation
├── whatsapp.ts        # WhatsApp implementation
└── index.ts           # Unified exports

app/api/webhooks/
├── telegram/
│   └── route.ts       # Telegram webhook handler
└── whatsapp/
    └── route.ts       # WhatsApp webhook handler
```

## Using the Abstraction

### Send a Message (Platform Agnostic)

```typescript
import { getMessagingProvider } from '@/lib/messaging';

// Works with either platform
const provider = getMessagingProvider('telegram'); // or 'whatsapp'
await provider.sendMessage('user_id', 'Hello!');
```

### Get All Enabled Providers

```typescript
import { getEnabledProviders } from '@/lib/messaging';

// Returns array of configured providers
const providers = getEnabledProviders();

// Send to all platforms
for (const provider of providers) {
  await provider.sendMessage(userId, 'Message for all platforms');
}
```

### Parse Webhooks

```typescript
import { getTelegramProvider } from '@/lib/messaging';

const telegram = getTelegramProvider();
const messages = telegram.parseWebhook(webhookPayload);

// All messages follow the same IncomingMessage format
for (const message of messages) {
  console.log(`${message.platform}: ${message.text}`);
}
```

## Platform Comparison

| Feature | Telegram | WhatsApp |
|---------|----------|----------|
| **Setup** | 2 minutes | 30+ minutes |
| **Verification** | None | Business account |
| **Cost** | Free forever | Free tier limited |
| **Buttons** | Unlimited | Max 3 |
| **Inline keyboards** | Yes | Limited |
| **File upload** | Up to 2GB | Up to 16MB |
| **Groups** | Full support | Limited |
| **Multi-device** | Native | Limited |
| **Bot commands** | Rich support | Basic |

## Configuration

### .env.local

```env
# Telegram (Recommended for testing)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# WhatsApp (Optional)
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

The system automatically detects which platforms are configured and enables them.

## Webhook URLs

- **Telegram**: `https://your-domain.com/api/webhooks/telegram`
- **WhatsApp**: `https://your-domain.com/api/webhooks/whatsapp`

## Business Logic (Platform Agnostic)

All core features work identically across platforms:

### Identity Resolution
```typescript
import { parseIdentity } from '@/lib/identity';

// Works for both Telegram and WhatsApp
const { username, cleanText } = parseIdentity(message.text);
```

### Submission Processing
```typescript
// Same code for both platforms
const submission = await createSubmission({
  kid_id: kid.id,
  original_text: message.text,
  platform: message.platform,  // Tracked but not used in logic
  // ... rest of fields
});
```

### LLM Processing
```typescript
// Platform doesn't matter for Gemini
const result = await processWithGemini(
  submission.media_url,
  submission.original_text
);
```

## Adding Future Platforms

To add a new platform (e.g., Discord, Slack):

1. **Create provider** (`lib/messaging/discord.ts`):
   ```typescript
   export class DiscordProvider implements MessagingProvider {
     readonly platform = 'discord' as const;
     // Implement interface methods...
   }
   ```

2. **Add webhook handler** (`app/api/webhooks/discord/route.ts`)

3. **Update types** (`lib/messaging/types.ts`):
   ```typescript
   platform: 'telegram' | 'whatsapp' | 'discord'
   ```

4. **Add to factory** (`lib/messaging/index.ts`)

5. **Add environment variables**

That's it! All business logic automatically works.

## Benefits

✅ **Flexibility** - Easy to test with Telegram, deploy with WhatsApp
✅ **Maintainability** - Business logic written once
✅ **Scalability** - Support multiple platforms without code duplication
✅ **Testability** - Mock providers easily for testing
✅ **Future-proof** - Add new platforms without refactoring

## Current Status

- ✅ Telegram fully implemented
- ✅ WhatsApp fully implemented
- ✅ Unified webhook handlers
- ✅ Identity parser works with both
- ✅ Both tested and building successfully

## Next Phase

Phase 2 will add:
- Database storage (works with both platforms)
- Identity resolution (already platform-agnostic)
- LLM processing (platform-agnostic)
- Parent notifications (works on both platforms)

The abstraction layer ensures all future features work seamlessly across platforms! 🚀

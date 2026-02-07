import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppProvider } from '@/lib/messaging';

/**
 * GET /api/webhooks/whatsapp
 *
 * WhatsApp webhook verification endpoint
 * Facebook sends a GET request to verify the webhook is valid
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check if mode and token are present
  if (mode && token) {
    // Check if mode and token match
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ WhatsApp webhook verified');
      // Respond with challenge token from the request
      return new NextResponse(challenge, { status: 200 });
    } else {
      console.error('❌ Verification failed - invalid token');
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  return new NextResponse('Bad Request', { status: 400 });
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Main webhook handler for incoming WhatsApp messages
 * CRITICAL: Must respond within 2 seconds
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Log incoming webhook (helpful for debugging)
    console.log('📨 WhatsApp webhook:', JSON.stringify(payload, null, 2));

    const whatsapp = getWhatsAppProvider();

    // Parse incoming messages
    const messages = whatsapp.parseWebhook(payload);

    if (messages.length === 0) {
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    // Process each message
    for (const message of messages) {
      console.log(`📱 WhatsApp message from ${message.from}:`, message);

      // PHASE 1: Simple echo bot
      if (message.text) {
        const echoMessage = `You said: "${message.text}"\n\n✅ Message received!\nPlatform: WhatsApp\nMessageID: ${message.messageId}`;

        // Send reply asynchronously (don't await - we need to respond quickly)
        whatsapp.sendMessage(message.from, echoMessage).catch((error) => {
          console.error('Failed to send echo message:', error);
        });

      } else if (message.image) {
        const imageMessage = `📸 Image received!\nCaption: ${message.image.caption || '(no caption)'}\nFileID: ${message.image.fileId}`;

        whatsapp.sendMessage(message.from, imageMessage).catch((error) => {
          console.error('Failed to send image acknowledgment:', error);
        });
      }
    }

    // CRITICAL: Respond immediately to WhatsApp (< 2s)
    return new NextResponse('EVENT_RECEIVED', { status: 200 });

  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    // Still return 200 to avoid WhatsApp retries
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  }
}

import axios from 'axios';
import type {
  MessagingProvider,
  IncomingMessage,
  MessageButton
} from './types';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

export class WhatsAppProvider implements MessagingProvider {
  readonly platform = 'whatsapp' as const;
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  /**
   * Send a text message
   */
  async sendMessage(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send a message with interactive buttons
   */
  async sendMessageWithButtons(
    to: string,
    text: string,
    buttons: MessageButton[]
  ): Promise<void> {
    try {
      // WhatsApp limits to 3 buttons
      const limitedButtons = buttons.slice(0, 3);

      await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: {
              buttons: limitedButtons.map(btn => ({
                type: 'reply',
                reply: {
                  id: btn.id,
                  title: btn.label.substring(0, 20) // Max 20 chars
                }
              }))
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to send WhatsApp message with buttons:', error);
      throw error;
    }
  }

  /**
   * Send a message with an image
   */
  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<void> {
    try {
      await axios.post(
        `${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: {
            link: imageUrl,
            caption
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Failed to send WhatsApp image:', error);
      throw error;
    }
  }

  /**
   * Download image/media from WhatsApp
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      // Step 1: Get media URL
      const mediaResponse = await axios.get(
        `${WHATSAPP_API_URL}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const mediaUrl = mediaResponse.data.url;

      // Step 2: Download media
      const downloadResponse = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(downloadResponse.data);
    } catch (error) {
      console.error('Failed to download WhatsApp media:', error);
      throw error;
    }
  }

  /**
   * Parse incoming WhatsApp webhook payload
   */
  parseWebhook(payload: any): IncomingMessage[] {
    const messages: IncomingMessage[] = [];

    if (payload.object !== 'whatsapp_business_account') {
      return messages;
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        if (!value.messages || value.messages.length === 0) {
          continue;
        }

        for (const msg of value.messages) {
          const incomingMessage: IncomingMessage = {
            messageId: msg.id,
            from: msg.from,
            timestamp: parseInt(msg.timestamp) * 1000,
            platform: 'whatsapp',
            raw: msg
          };

          // Get sender name if available
          if (value.contacts && value.contacts.length > 0) {
            const contact = value.contacts.find((c: any) => c.wa_id === msg.from);
            if (contact?.profile?.name) {
              incomingMessage.fromName = contact.profile.name;
            }
          }

          // Handle text message
          if (msg.type === 'text' && msg.text) {
            incomingMessage.text = msg.text.body;
          }

          // Handle image message
          if (msg.type === 'image' && msg.image) {
            incomingMessage.image = {
              fileId: msg.image.id,
              caption: msg.image.caption
            };
            incomingMessage.text = msg.image.caption; // Also set text for identity parsing
          }

          // Handle button reply
          if (msg.type === 'button' && msg.button) {
            incomingMessage.text = msg.button.payload || msg.button.text;
          }

          // Handle interactive reply
          if (msg.type === 'interactive' && msg.interactive) {
            if (msg.interactive.type === 'button_reply') {
              incomingMessage.text = msg.interactive.button_reply.id;
            }
          }

          messages.push(incomingMessage);
        }
      }
    }

    return messages;
  }
}

// Singleton instance
let whatsappInstance: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials not set');
  }

  if (!whatsappInstance) {
    whatsappInstance = new WhatsAppProvider(phoneNumberId, accessToken);
  }

  return whatsappInstance;
}

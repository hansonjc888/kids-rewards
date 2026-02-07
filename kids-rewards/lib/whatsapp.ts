import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

/**
 * Send a text message via WhatsApp Business API
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Missing WhatsApp credentials');
  }

  const payload: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: message
    }
  };

  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
 * Get WhatsApp media URL
 */
export async function getWhatsAppMediaUrl(
  mediaId: string
): Promise<string> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing WhatsApp access token');
  }

  try {
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return response.data.url;
  } catch (error) {
    console.error('Failed to get WhatsApp media URL:', error);
    throw error;
  }
}

/**
 * Download WhatsApp media
 */
export async function downloadWhatsAppMedia(
  mediaUrl: string
): Promise<Buffer> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing WhatsApp access token');
  }

  try {
    const response = await axios.get(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Failed to download WhatsApp media:', error);
    throw error;
  }
}

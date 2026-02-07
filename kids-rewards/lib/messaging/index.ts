/**
 * Unified Messaging Layer
 *
 * Supports multiple messaging platforms (Telegram, WhatsApp)
 * with the same interface
 */

export * from './types';
export * from './telegram';
export * from './whatsapp';

import type { MessagingProvider } from './types';
import { getTelegramProvider } from './telegram';
import { getWhatsAppProvider } from './whatsapp';

/**
 * Get messaging provider based on platform
 */
export function getMessagingProvider(
  platform: 'telegram' | 'whatsapp'
): MessagingProvider {
  switch (platform) {
    case 'telegram':
      return getTelegramProvider();
    case 'whatsapp':
      return getWhatsAppProvider();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get all enabled messaging providers
 */
export function getEnabledProviders(): MessagingProvider[] {
  const providers: MessagingProvider[] = [];

  // Check if Telegram is configured
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      providers.push(getTelegramProvider());
    } catch (error) {
      console.warn('Telegram not configured:', error);
    }
  }

  // Check if WhatsApp is configured
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    try {
      providers.push(getWhatsAppProvider());
    } catch (error) {
      console.warn('WhatsApp not configured:', error);
    }
  }

  return providers;
}

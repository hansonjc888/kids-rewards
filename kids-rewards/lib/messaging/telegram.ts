import TelegramBot from 'node-telegram-bot-api';
import type {
  MessagingProvider,
  IncomingMessage,
  MessageButton
} from './types';

export class TelegramProvider implements MessagingProvider {
  readonly platform = 'telegram' as const;
  private bot: TelegramBot;

  constructor(token: string) {
    // For webhooks, we don't use polling
    this.bot = new TelegramBot(token, { polling: false });
  }

  /**
   * Send a text message
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text);
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
      throw error;
    }
  }

  /**
   * Send a message with inline buttons
   */
  async sendMessageWithButtons(
    chatId: string,
    text: string,
    buttons: MessageButton[]
  ): Promise<void> {
    try {
      // Convert to Telegram inline keyboard format
      const keyboard = buttons.map(btn => [{
        text: btn.label,
        callback_data: btn.data || btn.id
      }]);

      await this.bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Failed to send Telegram message with buttons:', error);
      throw error;
    }
  }

  /**
   * Send a message with buttons grouped into rows
   */
  async sendMessageWithButtonRows(
    chatId: string,
    text: string,
    rows: MessageButton[][]
  ): Promise<void> {
    try {
      const keyboard = rows.map(row =>
        row.map(btn => ({
          text: btn.label,
          callback_data: btn.data || btn.id
        }))
      );

      await this.bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Failed to send Telegram message with button rows:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a callback query (button press)
   */
  async answerCallbackQuery(queryId: string, text?: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId, { text });
    } catch (error) {
      console.error('Failed to answer callback query:', error);
      throw error;
    }
  }

  /**
   * Edit an existing message's text (removes inline keyboard)
   */
  async editMessageText(chatId: string, messageId: number, text: string): Promise<void> {
    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId
      });
    } catch (error) {
      console.error('Failed to edit message text:', error);
      throw error;
    }
  }

  /**
   * Send a message with an image
   */
  async sendImage(
    chatId: string,
    imageUrl: string,
    caption?: string
  ): Promise<void> {
    try {
      await this.bot.sendPhoto(chatId, imageUrl, {
        caption
      });
    } catch (error) {
      console.error('Failed to send Telegram image:', error);
      throw error;
    }
  }

  /**
   * Download image/media from Telegram
   */
  async downloadMedia(fileId: string): Promise<Buffer> {
    try {
      // Get file path from Telegram
      const file = await this.bot.getFile(fileId);

      if (!file.file_path) {
        throw new Error('No file path returned from Telegram');
      }

      // Download file
      const fileStream = this.bot.getFileStream(fileId);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to download Telegram media:', error);
      throw error;
    }
  }

  /**
   * Parse incoming Telegram webhook payload
   */
  parseWebhook(payload: any): IncomingMessage[] {
    const messages: IncomingMessage[] = [];

    // Telegram sends updates, not batched entries
    if (!payload.message && !payload.callback_query) {
      return messages;
    }

    // Handle regular message
    if (payload.message) {
      const msg = payload.message;

      const incomingMessage: IncomingMessage = {
        messageId: msg.message_id.toString(),
        from: msg.chat.id.toString(),
        fromName: msg.from?.first_name || msg.from?.username || 'Unknown',
        timestamp: msg.date * 1000, // Convert to milliseconds
        platform: 'telegram',
        raw: msg
      };

      // Handle text message
      if (msg.text) {
        incomingMessage.text = msg.text;
      }

      // Handle photo message
      if (msg.photo && msg.photo.length > 0) {
        // Telegram sends multiple sizes, get the largest
        const largestPhoto = msg.photo[msg.photo.length - 1];
        incomingMessage.image = {
          fileId: largestPhoto.file_id,
          caption: msg.caption
        };
        incomingMessage.text = msg.caption; // Also set text for identity parsing
      }

      messages.push(incomingMessage);
    }

    // Handle callback query (button press)
    if (payload.callback_query) {
      const query = payload.callback_query;

      const incomingMessage: IncomingMessage = {
        messageId: query.id.toString(),
        from: query.message.chat.id.toString(),
        fromName: query.from?.first_name || query.from?.username || 'Unknown',
        timestamp: Date.now(),
        text: query.data, // Button callback data
        platform: 'telegram',
        raw: query
      };

      messages.push(incomingMessage);
    }

    return messages;
  }

  /**
   * Set webhook URL for Telegram
   */
  async setWebhook(url: string): Promise<void> {
    try {
      await this.bot.setWebHook(url);
      console.log(`✅ Telegram webhook set to: ${url}`);
    } catch (error) {
      console.error('Failed to set Telegram webhook:', error);
      throw error;
    }
  }

  /**
   * Delete webhook (use polling instead)
   */
  async deleteWebhook(): Promise<void> {
    try {
      await this.bot.deleteWebHook();
      console.log('✅ Telegram webhook deleted');
    } catch (error) {
      console.error('Failed to delete Telegram webhook:', error);
      throw error;
    }
  }

  /**
   * Get bot info
   */
  async getMe(): Promise<any> {
    return await this.bot.getMe();
  }
}

// Singleton instance
let telegramInstance: TelegramProvider | null = null;

export function getTelegramProvider(): TelegramProvider {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  if (!telegramInstance) {
    telegramInstance = new TelegramProvider(process.env.TELEGRAM_BOT_TOKEN);
  }

  return telegramInstance;
}

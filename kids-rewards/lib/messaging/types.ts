/**
 * Messaging Platform Abstraction
 *
 * This allows the system to work with multiple messaging platforms
 * (Telegram, WhatsApp, etc.) with the same core business logic
 */

export interface IncomingMessage {
  // Unique message ID from platform
  messageId: string;

  // Sender identifier (phone number, user ID, etc.)
  from: string;

  // Sender display name (if available)
  fromName?: string;

  // Message timestamp
  timestamp: number;

  // Message content
  text?: string;

  // Image data (if message contains image)
  image?: {
    fileId: string;
    caption?: string;
  };

  // Platform-specific raw data
  raw: any;

  // Platform identifier
  platform: 'telegram' | 'whatsapp';
}

export interface OutgoingMessage {
  to: string;
  text: string;
  buttons?: MessageButton[];
  image?: {
    url: string;
    caption?: string;
  };
}

export interface MessageButton {
  id: string;
  label: string;
  data?: string;
}

/**
 * Messaging Provider Interface
 *
 * Each messaging platform (Telegram, WhatsApp) implements this interface
 */
export interface MessagingProvider {
  /**
   * Platform identifier
   */
  readonly platform: 'telegram' | 'whatsapp';

  /**
   * Send a text message
   */
  sendMessage(to: string, text: string): Promise<void>;

  /**
   * Send a message with buttons
   */
  sendMessageWithButtons(
    to: string,
    text: string,
    buttons: MessageButton[]
  ): Promise<void>;

  /**
   * Send a message with an image
   */
  sendImage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<void>;

  /**
   * Send a message with buttons grouped into rows
   */
  sendMessageWithButtonRows?(
    to: string,
    text: string,
    rows: MessageButton[][]
  ): Promise<void>;

  /**
   * Acknowledge a callback query (button press)
   */
  answerCallbackQuery?(queryId: string, text?: string): Promise<void>;

  /**
   * Edit an existing message's text
   */
  editMessageText?(chatId: string, messageId: number, text: string): Promise<void>;

  /**
   * Download image/media from the platform
   */
  downloadMedia(fileId: string): Promise<Buffer>;

  /**
   * Parse incoming webhook payload into IncomingMessage
   */
  parseWebhook(payload: any): IncomingMessage[];
}

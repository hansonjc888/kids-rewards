export interface Household {
  id: string;
  name: string;
  settings: Record<string, any>;
  created_at: string;
}

export interface Kid {
  id: string;
  household_id: string;
  display_name: string;
  username: string;
  created_at: string;
}

export type SubmissionStatus =
  | 'pending_identity'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type IdentitySource =
  | 'explicit_at'
  | 'button'
  | 'parent_override';

export interface Submission {
  id: string;
  kid_id: string | null;
  household_id: string;
  whatsapp_message_id: string;
  whatsapp_from: string; // WhatsApp phone number
  original_text: string;
  media_url: string | null;
  llm_summary: string | null;
  category: string | null;
  tags: string[];
  confidence: number | null;
  status: SubmissionStatus;
  identity_source: IdentitySource | null;
  created_at: string;
}

export interface Approval {
  id: string;
  submission_id: string;
  parent_user_id: string | null;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface PointsLedger {
  id: string;
  kid_id: string;
  delta_points: number;
  reason: string;
  submission_id: string | null;
  created_at: string;
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  type: 'text' | 'image' | 'button' | 'interactive';
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: WhatsAppWebhookMessage[];
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

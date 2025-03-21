export interface EmailAddress {
  name: string
  email: string
}

export interface EmailAttachment {
  id: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  content?: string;
}

export interface Email {
  id: string;
  threadId?: string;
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  subject: string;
  snippet?: string;
  body: string;
  date: string;
  labels: string[]; // Keep this required
  attachments?: EmailAttachment[];
  accountId?: string;
  accountType?: 'gmail' | 'imap' | 'justcall' | 'twilio';
  read?: boolean;
  platform?: string; // Added for platform indication
  source?: string; // Added to track data source (gmail-api, imap, etc.)
  phoneNumber?: string;
  justcallTimes?: {
    sms_user_time?: string;
    sms_time?: string;
    sms_user_date?: string;
    sms_date?: string;
    formatted?: string;
  };
}

// Legacy interface - will be replaced by the new ContactModel
export interface Contact {
  name: string; // Keep this required
  email: string;
  lastMessageDate: string;
  lastMessageSubject: string;
  labels: string[]; // Keep this required
  accountId?: string;
  accountType?: 'gmail' | 'imap' | 'justcall' | 'twilio';
}

export interface Group {
  id: string;
  name: string;
  addresses: string[];
  phoneNumbers: string[];
}

// New interfaces for phase 2

export interface SyncAccountModel {
  id: string;
  userId: string;
  platform: string;
  accountIdentifier: string;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
  credentials: string;
}

export interface ContactModel {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  senders: SenderModel[];
  conversations: ConversationModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SenderModel {
  id: string;
  contactId: string;
  platform: string;
  identifier: string; // Email, phone number, etc.
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationModel {
  id: string;
  contactId: string;
  title?: string;
  lastActivity: Date;
  messages: MessageModel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageModel {
  id: string;
  conversationId: string;
  syncAccountId?: string;
  platform: string;
  externalId?: string;
  direction: 'inbound' | 'outbound';
  content: string;
  contentType: string;
  metadata?: any;
  attachments?: any;
  sentAt: Date;
  receivedAt: Date;
  isRead: boolean;
}

// JustCall specific types
export interface JustCallMessage {
  id: string;
  number: string;
  contact_number: string;
  body: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  updated_at: string;
  status: string;
  agent_id?: string;
  contact_id?: string;
  contact_name?: string;
  media?: any[];
  threadId?: string;
  // New fields for JustCall V2 API
  sms_info?: any;
  justcall_number?: string;
  justcall_line_name?: string;
  delivery_status?: string;
  // Time fields
  sms_user_time?: string;
  sms_time?: string;
  sms_user_date?: string;
  sms_date?: string;
}

export interface JustCallWebhookPayload {
  event: string;
  data: JustCallMessage;
}

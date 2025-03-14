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
  accountType?: 'gmail' | 'imap';
  read?: boolean;
}

export interface Contact {
  name: string; // Keep this required
  email: string;
  lastMessageDate: string;
  lastMessageSubject: string;
  labels: string[]; // Keep this required
  accountId?: string;
}
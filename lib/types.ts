export interface EmailAddress {
  name: string
  email: string
}

export interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  url?: string
}

export interface Email {
  id: string;
  threadId?: string;  // Optional for IMAP emails
  from: {
    name: string;
    email: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  subject: string;
  body: string;
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url?: string;
  }>;
  date: string;
  labels: string[];
  accountId?: string;  // Add this line for IMAP account identification
  accountType?: string; // Add this line to distinguish between gmail and imap
}

export interface Contact {
  name: string;
  email: string;
  lastMessageDate: string;
  lastMessageSubject: string;
  labels: string[];
  accountId?: string;  // Add this line for IMAP account identification
}
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
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  body: string
  date: string
  labels: string[]
  attachments?: Attachment[]
}

export interface Contact {
  name: string
  email: string
  lastMessageDate: string
  lastMessageSubject: string
  labels: string[]
}


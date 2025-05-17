// Enhanced WhatsApp utilities for message handling and conversation grouping

import { Email, Contact } from "@/lib/types";

/**
 * List of system broadcast messages that should be filtered out
 */
export const WHATSAPP_SYSTEM_BROADCASTS = [
  "🔒 Messages are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.",
  "BIZ_PRIVACY_MODE_TO_FB",
  "Messages and calls are end-to-end encrypted",
  "Your security code with",
  "Your chat is end-to-end encrypted",
  "Tap to learn more",
  "This chat is with a business account",
];

/**
 * Checks if a message is a system broadcast that should be filtered out
 */
export function isSystemMessage(text: string): boolean {
  if (!text) return false;

  // Check for exact matches first
  if (
    WHATSAPP_SYSTEM_BROADCASTS.some((broadcast) => text.includes(broadcast))
  ) {
    return true;
  }

  // Check for patterns that indicate system broadcasts
  return /^🔒|^end-to-end encrypted|^security code|^business account|^verified business|^[0-9]+ groups in common/i.test(
    text
  );
}

/**
 * Clean up phone numbers from WhatsApp format (e.g., "1234567890@s.whatsapp.net" or "1234567890@c.us")
 */
export function cleanPhoneNumber(input: string): string {
  if (!input) return input;

  // Match the pattern <number>@s.whatsapp.net or <number>@c.us or extract the phone number portion
  const whatsappMatch = input.match(/^([0-9+]+)@(s\.whatsapp\.net|c\.us)$/);
  if (whatsappMatch) {
    return whatsappMatch[1]; // Return just the phone number part
  }

  // Return the original if no match
  return input;
}

/**
 * Determine if a chat is a group chat
 */
export function isGroupChat(chatId: string): boolean {
  // Group chat IDs in WhatsApp typically end with @g.us
  return chatId.endsWith("@g.us");
}

/**
 * Determine if a message is from the current user (outbound)
 */
export function isMessageFromMe(message: any): boolean {
  if (!message) return false;

  // Check explicit sender flag (preferred)
  if (message.is_sender === 1 || message.is_sender === true) {
    return true;
  }

  // Check direction or labels
  if (
    message.direction === "outbound" ||
    message.labels?.includes("outbound") ||
    message.labels?.includes("OUTBOUND")
  ) {
    return true;
  }

  // Check sender field
  if (
    message.from &&
    (message.from.name === "You" ||
      message.from.name === "Me" ||
      message.from.email === "me" ||
      message.from.email === "You")
  ) {
    return true;
  }

  // Check for status flag if available
  if (message.status === "SENT" || message.status === "sent") {
    return true;
  }

  return false;
}

/**
 * Generate a proper display name for a contact
 */
export function getContactDisplayName(contact: any): string {
  if (!contact) return "Unknown";

  // If we have a proper name, use it
  if (
    contact.name &&
    contact.name !== "You" &&
    contact.name !== "Me" &&
    !contact.name.includes("@s.whatsapp.net") &&
    !contact.name.includes("@c.us") &&
    !contact.name.includes("@g.us")
  ) {
    return contact.name;
  }

  // If the name contains @s.whatsapp.net, extract the phone number
  if (
    contact.name &&
    (contact.name.includes("@s.whatsapp.net") || contact.name.includes("@c.us"))
  ) {
    return cleanPhoneNumber(contact.name);
  }

  // If we have an email that contains a phone number, use that
  if (
    contact.email &&
    (contact.email.includes("@s.whatsapp.net") ||
      contact.email.includes("@c.us"))
  ) {
    return cleanPhoneNumber(contact.email);
  }

  // Last resort, just use the email field directly if it looks like a phone number
  if (contact.email && /^[0-9+]+$/.test(contact.email)) {
    return contact.email;
  }

  return contact.name || contact.email || "Unknown Contact";
}

/**
 * Generate a consistent thread identifier for a WhatsApp chat
 * This helps prevent duplicate conversations in the channel list
 */
export function generateThreadIdentifier(email: Email): string {
  if (!email || !email.accountType || email.accountType !== "whatsapp") {
    return email.threadId || email.id;
  }

  // If we already have a threadId that's a chatId (ends with @g.us or @c.us), use it
  if (
    email.threadId &&
    (email.threadId.endsWith("@g.us") || email.threadId.endsWith("@c.us"))
  ) {
    return `whatsapp:${email.threadId}`;
  }

  // If we have a chat_id in the message, use that as the threadId
  if (email.metadata?.chat_id) {
    return `whatsapp:${email.metadata.chat_id}`;
  }

  // As a fallback, try to construct a thread ID from the sender/recipient
  // This ensures messages between the same parties are grouped together
  if (isMessageFromMe(email)) {
    // For outbound messages, use the first recipient as the thread identifier
    const recipient =
      email.to && email.to.length > 0 ? email.to[0].email : null;
    if (recipient) {
      return `whatsapp:${cleanPhoneNumber(recipient)}`;
    }
  } else {
    // For inbound messages, use the sender as the thread identifier
    if (email.from?.email) {
      return `whatsapp:${cleanPhoneNumber(email.from.email)}`;
    }
  }

  // Last resort - use whatever threadId is available or the ID itself
  return `whatsapp:${email.threadId || email.id}`;
}

/**
 * Format a raw WhatsApp message into our Email format with proper sender/recipient information
 */
export function formatWhatsAppMessage(
  message: any,
  chatInfo: any = null,
  accountId: string
): Email {
  // Determine if this is a group chat
  const chatId = message.chat_id || message.chatId;
  const isGroup = chatId ? isGroupChat(chatId) : false;

  // Determine message direction (from me or to me)
  const isSentByMe = isMessageFromMe(message);

  // Get the real sender ID
  const senderId = message.sender_id || message.from || "unknown";
  const cleanedSenderId = cleanPhoneNumber(senderId);

  // Get chat name for display
  const chatName = chatInfo?.name || "WhatsApp Chat";

  // For contacts, use proper naming with phone number extraction
  let displayName = "";

  if (isGroup) {
    // In group chats, if it's from me, use "You" as the sender name
    // Otherwise, use the sender_name if available or the cleaned phone number
    if (isSentByMe) {
      displayName = "You";
    } else {
      // Try to get the sender's name
      displayName = message.sender_name || cleanedSenderId;
    }
  } else {
    // For direct chats, if it's from me, use "You" as the sender name
    // Otherwise, use the chat name or the cleaned phone number
    if (isSentByMe) {
      displayName = "You";
    } else {
      displayName = chatName !== "You" ? chatName : cleanedSenderId;
    }
  }

  // Get text content
  const content = message.text || message.body || "";

  // Format the message as an Email object
  const formattedMessage: Email = {
    id: message.id,
    threadId: chatId, // Use the chat_id as threadId for consistent grouping
    from: {
      name: isSentByMe ? "You" : displayName,
      email: isSentByMe ? "me" : senderId,
    },
    to: [
      {
        name: isSentByMe ? (isGroup ? chatName : displayName) : "You",
        email: chatId || "whatsapp",
      },
    ],
    subject: isGroup ? chatName : displayName, // Use the chat name as the subject
    snippet: content.substring(0, 100),
    body: content,
    date: message.timestamp
      ? new Date(message.timestamp).toISOString()
      : new Date().toISOString(),
    labels: ["whatsapp"],
    read: message.seen === 1 || message.seen === true,
    accountId: accountId,
    accountType: "whatsapp",
    platform: "whatsapp",
    // Store additional metadata to help with conversation grouping
    metadata: {
      isGroup,
      chat_id: chatId,
      sender_id: senderId,
      sender_name: message.sender_name,
      group_name: isGroup ? chatName : undefined,
    },
  };

  return formattedMessage;
}

/**
 * Filter function to check if a message should be included in conversation
 * Used to properly group messages and avoid duplicates
 */
export function shouldIncludeInConversation(
  email: Email,
  contactEmail: string,
  isGroup: boolean,
  groupId: string | null
): boolean {
  // Skip handling non-WhatsApp messages
  if (email.accountType !== "whatsapp") return false;

  if (isGroup && groupId) {
    // For group conversations, check if the threadId matches the group chat ID
    return !!(
      email.threadId === groupId ||
      (email.metadata?.chat_id && email.metadata.chat_id === groupId)
    );
  } else {
    // For direct conversations, check if the contact is involved
    const contact = cleanPhoneNumber(contactEmail);

    // If the message is from me, check if it was sent to this contact
    if (isMessageFromMe(email)) {
      return email.to.some((to) => cleanPhoneNumber(to.email) === contact);
    }
    // If the message is to me, check if it was sent by this contact
    else {
      return cleanPhoneNumber(email.from.email) === contact;
    }
  }
}

/**
 * Create a robust contact key for WhatsApp contacts
 * This helps avoid duplicate contacts in the list
 */
export function createWhatsAppContactKey(email: Email): string {
  if (email.accountType !== "whatsapp") return "";

  // For group chats, use the chat ID (threadId) as the key
  if (
    email.metadata?.isGroup ||
    (email.threadId && email.threadId.endsWith("@g.us"))
  ) {
    return `whatsapp:group:${email.threadId}`;
  }

  // For direct chats, use the contact's phone number
  if (isMessageFromMe(email)) {
    // If it's a message from me, use the recipient
    const recipientEmail =
      email.to && email.to.length > 0 ? email.to[0].email : null;
    if (recipientEmail) {
      return `whatsapp:contact:${cleanPhoneNumber(recipientEmail)}`;
    }
  } else {
    // If it's a message to me, use the sender
    if (email.from?.email) {
      return `whatsapp:contact:${cleanPhoneNumber(email.from.email)}`;
    }
  }

  // Fallback to threadId
  return `whatsapp:${email.threadId || email.id}`;
}

/**
 * Create a contact model from WhatsApp message
 */
export function createWhatsAppContact(email: Email): Contact | null {
  if (email.accountType !== "whatsapp") return null;

  const isGroup =
    email.metadata?.isGroup ||
    (email.threadId && email.threadId.endsWith("@g.us"));
  let contactName: string;
  let contactEmail: string;

  if (isGroup) {
    // For group chats, use the group name and chatId
    contactName =
      email.metadata?.group_name || email.subject || "WhatsApp Group";
    contactEmail = email.threadId || ""; // Use the chat ID as the contact email
  } else {
    // For direct chats
    if (isMessageFromMe(email)) {
      // If it's from me, use the recipient info
      const recipient = email.to && email.to.length > 0 ? email.to[0] : null;
      if (!recipient) return null;

      contactName =
        recipient.name !== "You"
          ? recipient.name
          : cleanPhoneNumber(recipient.email);
      contactEmail = recipient.email;
    } else {
      // If it's to me, use the sender info
      contactName =
        email.from.name !== "You"
          ? email.from.name
          : cleanPhoneNumber(email.from.email);
      contactEmail = email.from.email;
    }
  }

  return {
    name: contactName,
    email: contactEmail,
    lastMessageDate: email.date,
    lastMessageSubject: email.snippet || email.subject,
    labels: ["whatsapp"],
    accountId: email.accountId,
    accountType: "whatsapp",
  };
}

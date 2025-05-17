// Utilities for formatting and filtering WhatsApp messages and contacts

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
export function isWhatsAppSystemBroadcast(text: string): boolean {
  if (!text) return false;

  // Check for exact matches first
  if (
    WHATSAPP_SYSTEM_BROADCASTS.some((broadcast) => text.includes(broadcast))
  ) {
    return true;
  }

  // Check for patterns that indicate system broadcasts
  return /^🔒|^end-to-end encrypted|^security code|^business account|^verified business/i.test(
    text
  );
}

/**
 * Clean up phone numbers from WhatsApp format (e.g., "1234567890@s.whatsapp.net")
 */
export function cleanWhatsAppPhoneNumber(input: string): string {
  if (!input) return input;

  // Match the pattern <number>@s.whatsapp.net or extract the phone number portion
  const whatsappMatch = input.match(/^([0-9+]+)@s\.whatsapp\.net$/);
  if (whatsappMatch) {
    return whatsappMatch[1]; // Return just the phone number part
  }

  return input;
}

/**
 * Determine if a message is from the current user (outbound) based on WhatsApp-specific logic
 */
export function isWhatsAppMessageFromMe(message: any): boolean {
  // In Unipile, the is_sender flag is 1 for outbound messages
  if (message.is_sender === 1) {
    return true;
  }

  // Check if the message is marked as outbound in any way
  if (
    message.labels?.includes("outbound") ||
    message.labels?.includes("OUTBOUND") ||
    message.direction === "outbound"
  ) {
    return true;
  }

  // Check the from field - if it contains "You" it's likely outbound
  if (
    message.from &&
    (message.from.name === "You" || message.from.email === "You")
  ) {
    return true;
  }

  return false;
}

/**
 * Generate a proper display name for a WhatsApp contact
 */
export function getWhatsAppContactDisplayName(contact: any): string {
  if (!contact) return "Unknown";

  // If we have a proper name, use it
  if (
    contact.name &&
    contact.name !== "You" &&
    !contact.name.includes("@s.whatsapp.net")
  ) {
    return contact.name;
  }

  // If the name contains @s.whatsapp.net, extract the phone number
  if (contact.name && contact.name.includes("@s.whatsapp.net")) {
    return cleanWhatsAppPhoneNumber(contact.name);
  }

  // If we have an email that contains a phone number, use that
  if (contact.email && contact.email.includes("@s.whatsapp.net")) {
    return cleanWhatsAppPhoneNumber(contact.email);
  }

  // Last resort, just use the email field directly if it looks like a phone number
  if (contact.email && /^[0-9+]+$/.test(contact.email)) {
    return contact.email;
  }

  return contact.name || contact.email || "Unknown Contact";
}

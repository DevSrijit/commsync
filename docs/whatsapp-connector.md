# WhatsApp Connector Integration

This document provides a detailed overview of the architecture, implementation details, and the latest progress on the WhatsApp connector integration powered by the Unipile Node.js SDK. It serves both as a guide for AI models to understand the system and a reference for stakeholders.

---

## 📦 Overview

Commsync now fully supports WhatsApp messaging through the Unipile Node.js SDK. This connector aligns with our existing patterns for email and SMS integrations, offering:

- **Account Linking** via QR code (hosted auth flow)
- **Persistent Account Records** in the database
- **Automatic Syncing** of accounts, chats, and messages into the client store
- **REST API Endpoints** for QR generation, account management, chats, messages, and sending
- **End-to-End UI/UX** in the sidebar and message composer
- **Group Chat Support** with proper message threading and sender identification

---

## 🚀 Progress & Achievements

### 1️⃣ Service Layer (`lib/unipile-service.ts`)

- **getWhatsappQRCode()**
  - Returns `{ qrCodeString, code }` from `client.account.connectWhatsapp()`.
- **getAllWhatsAppChats(accountId)**
  - Retrieves all chats via `client.messaging.getAllChats({ account_id })`.
- **getWhatsAppMessages(chatId)**
  - Fetches chat messages via `client.messaging.getAllMessagesFromChat({ chat_id })`.
- **sendWhatsAppMessage(chatId, text, attachments)**
  - Sends messages through `client.messaging.sendMessage({ chat_id, text, attachments })`.
- **handleWebhook(rawBody, signature)**
  - Verifies HMAC-SHA256 signature, parses events, upserts conversations & messages into `db.message`.

### 2️⃣ Utility Functions (`lib/whatsapp-utils.ts`)

The enhanced WhatsApp utilities introduce several critical functions:

- **isMessageFromMe(message)**: Determines if a message was sent by the current user
- **isGroupChat(chatId)**: Checks if a chat ID represents a group chat (ends with @g.us)  
- **isSystemMessage(text)**: Filters out system broadcasts and notifications
- **cleanPhoneNumber(input)**: Removes WhatsApp formatting from phone numbers
- **getContactDisplayName(contact)**: Generates proper display names for contacts
- **generateThreadIdentifier(email)**: Creates consistent thread IDs to prevent duplicates
- **formatWhatsAppMessage(message, chatInfo, accountId)**: Converts raw messages to our Email format
- **createWhatsAppContact(email)**: Generates Contact objects with proper naming

### 3️⃣ Database & API Routes

All routes live under `app/api/whatsapp`:

- **GET /api/whatsapp/qr**  → Returns `{ qrCodeString, code }` for the QR-scan flow.
- **GET /api/whatsapp/account**
  - Lists linked `SyncAccount` entries with `platform = 'whatsapp'`.
- **POST /api/whatsapp/account**
  - Links a new account by storing `{ code }` in `db.syncAccount`, returning the created record.
- **DELETE /api/whatsapp/account?id={id}**
  - Unlinks an account by its `id`.
- **GET /api/whatsapp/chats?accountId={id}**
  - Lists chats via `UnipileService.getAllWhatsAppChats`.
- **GET /api/whatsapp/chats/{chatId}/messages?accountId={id}**
  - Retrieves messages via `UnipileService.getWhatsAppMessages`.
- **POST /api/whatsapp/send**
  - Sends a WhatsApp message by forwarding `{ chatId, text, attachments }` to `sendWhatsAppMessage`.
- **POST /api/whatsapp/webhook**
  - Verifies signatures and dispatches incoming events (configured separately).

---

## 🔧 Client Store Enhancements (`lib/email-store.ts` & `lib/sync-service.ts`)

- **State**:
  - `whatsappAccounts: any[]`
  - `syncWhatsappAccounts(isLoadingMore?: boolean): Promise<number>`
  - `setWhatsappAccounts(accounts: any[]): void`
- **Auto-sync on Init & Interval**:
  - Loads persisted `whatsappAccounts` from `client-cache-browser`.
  - Executes `syncWhatsappAccounts` 1s after load, and every 5 minutes thereafter.
- **syncWhatsappAccounts Implementation**:
  - For each `SyncAccount`:
    - Fetch `/api/whatsapp/chats?accountId` → iterate chats
    - Fetch `/api/whatsapp/chats/{chatId}/messages?accountId` → format each message as an `Email` object
    - Use `formatWhatsAppMessage` to properly identify senders and format messages
    - Filter out system broadcasts using `isSystemMessage`
    - Invoke `store.addEmail(formatted)` to merge into the global message store
  - Returns total messages ingested.
- **Conversation Deduplication**:
  - Uses `createWhatsAppContactKey` and `generateThreadIdentifier` to prevent duplicate chats
  - Differentiates between direct messages and group chats
  - Uses chat_id and sender_id to properly track message history
- **syncAllPlatforms**:
  - Now invokes `syncWhatsappAccounts` in parallel with other platforms (IMAP, Twilio, JustCall, BulkVS).

---

## 🖥 UI & UX Integration

### **1. Conversation View** (`components/conversation-view.tsx`)

- **Group Chat Handling**:
  - Shows proper sender names in group chats using `email.metadata?.sender_name`
  - Outbound messages consistently show "You" as the sender name
  - System messages are filtered out using `isSystemMessage`
- **Message Formatting**:
  - WhatsApp messages are displayed with proper text formatting
  - Shows warnings for unsupported message types
  - Renders images and attachments when available

### **2. Channel List** (`components/channel-list.tsx`)

- **Contact Deduplication**:
  - Uses `createWhatsAppContactKey` to prevent duplicate chat entries
  - Displays group chats with the group name
  - Filters out "self-conversation" that shows all sent messages
- **Grouping Logic**:
  - Properly separates direct chats from group chats
  - Ensures consistent grouping of messages with the same chat ID

### **3. Sidebar Flow** (`components/sidebar.tsx`)

- **New Collapsible Section**: "WhatsApp Accounts" alongside Email & SMS.
- **Add Account**: Button opens the `WhatsAppAccountDialog`.
- **Account List**: Renders `WhatsAppAccountCard` for each linked account.
- **Event-Driven Updates**: Listens for `whatsapp-accounts-updated` events to refresh UI.

### **4. QR Code Dialog** (`components/whatsapp-account-dialog.tsx`)

- Polls `/api/whatsapp/qr` every 60s to refresh the QR and `code`.
- Displays ASCII QR in a `<pre>` block with a countdown timer.
- **Connect** button POSTs `{ code }` to `/api/whatsapp/account`, closes dialog, and dispatches an update event.

### **5. Account Card** (`components/whatsapp-account-card.tsx`)

- Displays `label`, `id`, and human-friendly "Last synced" status.
- **Sync** button:
  - Triggers `/api/sync` with `{ platform: 'whatsapp', accountId }`, shows toast, and refreshes sidebar.
- **Delete** button:
  - Calls DELETE `/api/whatsapp/account?id={id}`, removes card, and shows toast.
- **Auto-Sync**: On mount, if `lastSync` > 1 hour ago, automatically initiates a sync.

### **6. Message Composer** (`components/message-composer.tsx`)

- Extended `platform` enum to include `"whatsapp"`.
- Adds **WhatsApp** to the platform selector.
- On **Send**:
  - POSTs to `/api/whatsapp/send` with `{ chatId, text }`.
  - Optionally refreshes store via `syncAllPlatforms` after a short delay.

---

## 🔌 End-to-End Flow

1. **Linking**:
   - User opens QR dialog → scans QR in WhatsApp → clicks **Connect** → backend stores `SyncAccount`.
2. **Syncing**:
   - Sidebar and store automatically fetch linked accounts → `syncWhatsappAccounts` ingests chats & messages.
   - Manual **Sync** available per account and global **Sync SMS / Sync Email** buttons.
3. **Messaging**:
   - User composes a new message → selects **WhatsApp** → enters a valid `chatId` (phone or chat identifier) → **Send** → UI optimistically updates and triggers a backend send.
4. **Receiving**:
   - Unipile webhook posts to `/api/whatsapp/webhook` → `handleWebhook` validates and persists messages → next sync surfaces new messages in the UI.
5. **Group Chats**:
   - For group chats, messages are displayed with proper sender identification.
   - Outbound messages are consistently shown with "You" as the sender.
   - Group info and metadata are preserved in message objects.

---

## 🔧 Recent Fixes & Improvements

### 1. Message Handling Fixes

- Fixed issues with sender names in group chats - now shows correct sender for each message
- Ensured outbound messages consistently show "You" as the sender
- Improved filtering of system broadcast messages to prevent clutter
- Fixed TypeScript errors in `shouldIncludeInConversation` and other utility functions
- Ensured all WhatsApp utilities consistently handle null or undefined values with proper type checking

### 2. Group Chat Improvements

- Added proper sender name display in group conversations
- Fixed issues where messages from different senders in group chats were showing the group name
- Ensured proper threading of messages in group conversations
- Eliminated duplicate messages from the same conversation
- Added metadata to messages to consistently track group information

### 3. Contact List Improvements

- Fixed issue where a "self-conversation" chat was appearing in the channel list
- Added robust deduplication of contacts to prevent multiple entries
- Improved contact name display to show proper names or phone numbers
- Ensured consistent grouping of messages from the same contact
- Fixed linter errors and typing issues in `channel-list.tsx` for better code reliability:
  - Added proper optional chaining for `filteredContacts` to prevent undefined access
  - Fixed session handling in `loadMoreMessages` to properly access user tokens
  - Added missing state variables and functions for proper filtering
  - Improved error handling in load operations

### 4. Synchronization Enhancements

- Fixed threading issues that were causing duplicate conversations
- Improved error handling in sync operations
- Added proper type annotations for better code reliability
- Enhanced the filtering logic to avoid duplicate messages
- Fixed TypeScript errors in `sync-service.ts` to ensure proper handling of API responses
- Enhanced WhatsApp utility functions for better consistency and error handling:
  - `isMessageFromMe`: More robust checking of message sender
  - `cleanPhoneNumber`: Better handling of various phone number formats
  - `isGroupChat`: Reliable identification of group chats
  - `createWhatsAppContactKey`: Consistent key generation for deduplication

### 5. Code Quality Improvements

- Moved WhatsApp-specific logic from `whatsapp-filters.ts` to a dedicated `whatsapp-utils.ts` file
- Added extensive TypeScript type checking to prevent runtime errors
- Improved error handling with proper null/undefined checks
- Added consistent optional chaining to prevent "possibly undefined" errors
- Ensured all components use the new utility functions consistently
- Updated imports to use the dedicated utility functions across the codebase
- Fixed dependency issues in useCallback to ensure proper reactivity

---

## 📝 Next Steps & Known Improvements

- **Error Handling & Retries**: Add robust retry logic for network failures.
- **Automated Testing**: Unit tests for service methods and E2E tests for the QR flow, syncing, and sending.
- **UI/UX Polish**: Accessibility review, responsive styling, and consistent theming.
- **Metadata Persistence**: Extend `SyncAccount.settings` or create a dedicated `WhatsAppConnection` model for channel-specific data (e.g., default chat filters).
- **Advanced WhatsApp Features**: Support for reactions, stickers, and other rich media formats.
- **Media Handling**: Improve support for audio messages, videos, and location sharing.
- **.env.example**: Document required variables:

```
UNIPILE_BASE_URL=<your-unipile-base-url>
UNIPILE_ACCESS_TOKEN=<your-access-token>
UNIPILE_WEBHOOK_SECRET=<webhook-signing-secret>
```

Happy coding and messaging! 🚀

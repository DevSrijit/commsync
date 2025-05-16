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

### 2️⃣ Database & API Routes

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

## 🔧 Client Store Enhancements (`lib/email-store.ts`)

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
    - Invoke `store.addEmail(formatted)` to merge into the global message store
  - Returns total messages ingested.
- **syncAllPlatforms**:
  - Now invokes `syncWhatsappAccounts` in parallel with other platforms (IMAP, Twilio, JustCall, BulkVS).

---

## 🖥 UI & UX Integration

### **1. Sidebar Flow** (`components/sidebar.tsx`)

- **New Collapsible Section**: "WhatsApp Accounts" alongside Email & SMS.
- **Add Account**: Button opens the `WhatsAppAccountDialog`.
- **Account List**: Renders `WhatsAppAccountCard` for each linked account.
- **Event-Driven Updates**: Listens for `whatsapp-accounts-updated` events to refresh UI.

### **2. QR Code Dialog** (`components/whatsapp-account-dialog.tsx`)

- Polls `/api/whatsapp/qr` every 60s to refresh the QR and `code`.
- Displays ASCII QR in a `<pre>` block with a countdown timer.
- **Connect** button POSTs `{ code }` to `/api/whatsapp/account`, closes dialog, and dispatches an update event.

### **3. Account Card** (`components/whatsapp-account-card.tsx`)

- Displays `label`, `id`, and human-friendly "Last synced" status.
- **Sync** button:
  - Triggers `/api/sync` with `{ platform: 'whatsapp', accountId }`, shows toast, and refreshes sidebar.
- **Delete** button:
  - Calls DELETE `/api/whatsapp/account?id={id}`, removes card, and shows toast.
- **Auto-Sync**: On mount, if `lastSync` > 1 hour ago, automatically initiates a sync.

### **4. Message Composer** (`components/message-composer.tsx`)

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

---

## 📝 Next Steps & Known Improvements

- **Error Handling & Retries**: Add robust retry logic for network failures.
- **Automated Testing**: Unit tests for service methods and E2E tests for the QR flow, syncing, and sending.
- **UI/UX Polish**: Accessibility review, responsive styling, and consistent theming.
- **Metadata Persistence**: Extend `SyncAccount.settings` or create a dedicated `WhatsAppConnection` model for channel-specific data (e.g., default chat filters).
- **Conversation View Enhancements**: Render attachments, read receipts, typing indicators.
- **.env.example**: Document required variables:

```
UNIPILE_BASE_URL=<your-unipile-base-url>
UNIPILE_ACCESS_TOKEN=<your-access-token>
UNIPILE_WEBHOOK_SECRET=<webhook-signing-secret>
```

Happy coding and messaging! 🚀

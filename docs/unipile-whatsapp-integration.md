# Unipile WhatsApp Integration

This document outlines the implementation of WhatsApp messaging integration in CommSync using Unipile's API.

## Overview

The Unipile integration enables CommSync to connect with WhatsApp and other messaging platforms through a unified API. This implementation focuses on WhatsApp as the initial messaging platform, allowing users to:

1. Connect WhatsApp accounts via QR code scanning
2. Send and receive WhatsApp messages in real-time
3. View message history alongside other communication channels
4. Manage WhatsApp connections from the CommSync interface

## Setup Requirements

### Prerequisites

- Node.js 18+ (Bun is recommended for development)
- Unipile API credentials (DSN and Access Token)
- PostgreSQL database for storing account information
- Proper environment configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
UNIPILE_DSN=https://your-unipile-dsn
UNIPILE_ACCESS_TOKEN=your-unipile-access-token
```

### Installation

Install dependencies using Bun:

```bash
bun install unipile-node-sdk
```

## Architecture

The WhatsApp integration consists of the following components:

1. **Core Services:**
   - `UnipileService`: Manages WhatsApp connections, message sending, and retrieval
   - `UnipileSyncService`: Handles real-time message syncing and webhooks

2. **UI Components:**
   - `WhatsAppAccountDialog`: QR code scanning interface for connecting accounts
   - `WhatsAppAccountCard`: Display and management of connected accounts

3. **API Routes:**
   - `/api/unipile/connect-whatsapp`: Initiates WhatsApp connections
   - `/api/unipile/check-status`: Monitors connection status
   - `/api/unipile/account`: Manages WhatsApp accounts
   - `/api/unipile/webhook`: Handles Unipile webhooks
   - `/api/unipile/message`: Sends messages through Unipile
   - `/api/unipile/sync`: Manually syncs messages
   - `/api/unipile/start-sync`: Starts the background sync service

4. **Data Model:**
   - `UnipileAccount`: Stores WhatsApp account information in the database

## Implementation Details

### UnipileService

The `UnipileService` class provides a singleton interface to the Unipile SDK, handling all direct API calls:

```typescript
// Core initialization
private constructor() {
  this.dsn = process.env.UNIPILE_DSN || "";
  this.accessToken = process.env.UNIPILE_ACCESS_TOKEN || "";
  this.initClient();
}

// WhatsApp connection flow
public async connectWhatsapp(): Promise<{
  qrCodeString: string;
  account: UnipileAccount;
}> {
  if (!this.client) {
    throw new Error("Unipile client not initialized");
  }

  try {
    // Connect to WhatsApp and get QR code
    const response = await this.client.account.connectWhatsapp();

    // Create a temporary account entry in the database
    const newAccount = await db.unipileAccount.create({
      data: {
        provider: "whatsapp",
        accountIdentifier: "pending", // Will be updated once connection is complete
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      qrCodeString: response.qrCodeString,
      account: newAccount as unknown as UnipileAccount,
    };
  } catch (error) {
    console.error("Failed to connect WhatsApp:", error);
    throw error;
  }
}
```

### Real-time Message Syncing

The `UnipileSyncService` manages two approaches to real-time updates:

1. **Webhooks**: For immediate message delivery using the Unipile webhook system
2. **Polling**: For periodic checks that ensure no messages are missed

```typescript
// Webhook handling
public async handleWebhookEvent(event: any): Promise<void> {
  try {
    if (!event || !event.type) {
      console.error("Invalid webhook event:", event);
      return;
    }

    switch (event.type) {
      case "new_message":
        await this.handleNewMessage(event.data);
        break;
      case "account_status":
        await this.handleAccountStatus(event.data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Error handling webhook event:", error);
  }
}

// Periodic sync
private async syncAccount(account: UnipileAccount): Promise<number> {
  try {
    const chatResponse = await this.unipileService.getAllChats(account.id);
    
    if (!chatResponse || !chatResponse.items) {
      console.log(`No chats found for account ${account.id}`);
      return 0;
    }
    
    const chats = chatResponse.items || [];
    
    // Sync messages from each chat
    // ...
  }
  // ...
}
```

### UI Integration

The UI components provide an intuitive interface for connecting and managing WhatsApp accounts:

1. **QR Code Scanning**: Uses the `WhatsAppAccountDialog` component to display a QR code that users scan with their phone
2. **Account Management**: The `WhatsAppAccountCard` component displays connected accounts and allows disconnection
3. **Messaging Integration**: Messages are displayed in the main interface alongside other communication channels

### Backend API Routes

Several API routes handle the different aspects of the WhatsApp integration:

1. **Connection Initiation**:

```typescript
// app/api/unipile/connect-whatsapp/route.ts
export async function POST() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the Unipile service instance
    const unipileService = getUnipileService();

    // Initiate WhatsApp connection
    const { qrCodeString, account } = await unipileService.connectWhatsapp();

    // Associate the account with the user
    await db.unipileAccount.update({
      where: { id: account.id },
      data: {
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      qrCodeString,
      accountId: account.id,
    });
  } catch (error) {
    console.error("Error connecting WhatsApp:", error);
    return NextResponse.json(
      { error: "Failed to connect WhatsApp" },
      { status: 500 }
    );
  }
}
```

2. **Message Sending**:

```typescript
// app/api/unipile/message/route.ts
export async function POST(request: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the message data from the request
    const messageData: MessageData = await request.json();

    // Validate required fields
    if (!messageData.content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Send the message through Unipile
    const unipileService = getUnipileService();
    const response = await unipileService.sendMessage(messageData);
    
    return NextResponse.json({
      success: true,
      messageId: response.id,
    });
  } catch (error) {
    console.error("Error sending Unipile message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
```

## Database Schema

The integration utilizes the `UnipileAccount` model in the Prisma schema:

```prisma
model UnipileAccount {
  id                String    @id @default(cuid())
  userId            String
  provider          String // whatsapp, linkedin, instagram, etc.
  accountIdentifier String // ID from Unipile
  status            String // pending, connected, disconnected
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  lastSync          DateTime?

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([provider])
  @@index([accountIdentifier])
}
```

## Usage Examples

### Connecting a WhatsApp Account

1. User clicks "Add WhatsApp Account" in the Messaging Accounts section
2. The `WhatsAppAccountDialog` opens showing instructions
3. After clicking "Generate QR Code", a QR code appears
4. User scans the QR code with their WhatsApp mobile app
5. The connection status updates automatically when complete

### Sending a WhatsApp Message

```typescript
// Example of sending a message
const messageData = {
  content: "Hello from CommSync!",
  recipients: ["123456789"], // WhatsApp number
  accountId: "whatsapp-account-id",
  platform: "unipile",
};

// Send using the API route
const response = await fetch('/api/unipile/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(messageData),
});
```

### Receiving WhatsApp Messages

Messages are received through two mechanisms:

1. Unipile webhooks for immediate delivery
2. Periodic polling via the sync service as a backup

Both approaches update the CommSync message store, making new messages instantly visible in the UI.

## Troubleshooting

### Common Issues

1. **QR Code Timeout**: If the QR code expires, simply generate a new one
2. **Connection Drops**: WhatsApp connections can sometimes disconnect if the phone's battery optimization closes WhatsApp; ensure WhatsApp is allowed to run in the background
3. **Message Delays**: If messages aren't appearing immediately, check that the webhook endpoint is properly configured and accessible

### Logging

The implementation includes extensive logging to help diagnose issues:

- Connection attempts and statuses
- Message send/receive events
- Webhook processing
- Sync service activity

## Future Enhancements

1. **Multi-Device Support**: Handle multiple WhatsApp accounts per user
2. **Media Handling**: Improved support for images, audio, and other media types
3. **Group Chat Support**: Enhanced integration with WhatsApp group chats
4. **Additional Platforms**: Extending to other Unipile-supported messaging platforms (Instagram, Telegram, etc.)

## Security Considerations

1. The implementation securely stores account identifiers but not actual WhatsApp credentials
2. WhatsApp connections are authenticated through QR code scanning, not password storage
3. Account disconnect functionality is provided to allow users to revoke access
4. All API routes are protected by authentication checks

## Development with Bun

For developers using Bun, the recommended commands are:

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build

# Start production server
bun start
```

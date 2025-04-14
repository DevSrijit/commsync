# BulkVS Integration Guide

## Overview

CommSync now integrates with BulkVS, allowing you to connect your BulkVS accounts, sync messages, and send/receive SMS through the CommSync interface. The integration works alongside existing Twilio and JustCall integrations, giving you a unified messaging experience across multiple SMS providers.

## Features

- **Account Connection**: Link your BulkVS accounts with API key authentication
- **Message Syncing**: Sync your SMS history with automatic background updates
- **Real-time Messaging**: Send and receive messages directly from the CommSync interface
- **Media Support**: Send and receive media attachments in your SMS conversations
- **Multi-account Support**: Connect multiple BulkVS accounts simultaneously
- **Webhook Support**: Receive incoming messages in real-time (optional)

## Connecting a BulkVS Account

1. Navigate to the SMS section in the sidebar
2. Click "Add BulkVS Account"
3. Enter the following information:
   - **Account Label**: A name to identify this account in CommSync
   - **API Key**: Your BulkVS API key (found in your BulkVS portal under API settings)
   - **Phone Number**: The phone number in your BulkVS account you want to use (must be in the format +1XXXXXXXXXX)
4. Click "Link Account"

CommSync will validate your credentials and create the connection. Once connected, your BulkVS messages will begin syncing automatically.

## How Syncing Works

The BulkVS integration supports two synchronization methods:

### 1. Scheduled Polling (Default)

By default, CommSync will synchronize your BulkVS messages through the following methods:

- **Automatic background sync**: Messages are synced every 5 minutes
- **Manual sync**: You can trigger a sync manually by clicking the "Sync" button on your BulkVS account card
- **Initial connection sync**: A full sync is performed when you first connect your account
- **Login sync**: Messages are refreshed when you log in to CommSync

This polling-based approach ensures your messages stay up-to-date even without a webhook configuration.

### 2. Real-time Webhooks (Optional)

For immediate message delivery, you can set up a webhook in your BulkVS account:

1. Log in to your BulkVS portal
2. Navigate to API settings or Webhooks configuration
3. Add a new webhook with the following URL:

   ```
   https://your-commsync-domain.com/api/bulkvs/webhook
   ```

4. Enable the webhook for SMS events

When configured, new incoming messages will appear in CommSync immediately without waiting for the next polling cycle.

**Note**: The webhook is optional. If not configured, messages will still sync through the regular polling mechanism.

## Troubleshooting

If you encounter issues with your BulkVS integration, try these steps:

1. **Verify API Key**: Ensure your API key is valid and has the necessary permissions
2. **Check Phone Number Format**: The phone number must exactly match the format in your BulkVS account
3. **Manual Sync**: Try clicking the "Sync" button on your BulkVS account card
4. **Debug Mode**: In development environments, you can use the debug endpoint at `/api/debug/bulkvs` to test your connection

For webhook issues:

1. Verify the webhook URL is correctly configured in your BulkVS account
2. Check that your CommSync instance is publicly accessible
3. Ensure your BulkVS account has webhook permissions enabled

## Limitations

- Media attachments require public URLs that BulkVS can access
- BulkVS rate limits may apply based on your BulkVS plan
- Initial sync may be limited to recent messages (typically 100 by default)

## Security Considerations

- All BulkVS credentials are encrypted before storage
- API keys are never exposed in client-side code
- Webhook endpoints validate that messages are associated with your accounts

## Technical Details

The BulkVS integration is implemented with the following components:

- `bulkvs-service.ts`: Core service for interacting with the BulkVS API
- `bulkvs-account-dialog.tsx`: UI for adding new BulkVS accounts
- `bulkvs-account-card.tsx`: UI for managing existing BulkVS accounts
- API routes:
  - `/api/bulkvs/link`: Links new BulkVS accounts
  - `/api/bulkvs/account`: Manages existing accounts
  - `/api/bulkvs/send`: Sends messages
  - `/api/bulkvs/sync`: Triggers manual sync
  - `/api/bulkvs/webhook`: Receives incoming webhook events
  - `/api/sync`: Central sync endpoint for all platforms

Messages are stored in the same format as other SMS platforms, allowing unified display and management in the CommSync interface.

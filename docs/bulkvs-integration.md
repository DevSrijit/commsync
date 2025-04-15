# BulkVS Integration Guide

## Overview

CommSync integrates with BulkVS, allowing you to connect your BulkVS accounts, send SMS/MMS messages, and receive messages via webhooks through the CommSync interface. This integration provides a unified messaging experience alongside your existing Twilio and JustCall connections.

## Features

- **Account Connection**: Link your BulkVS accounts with API credentials authentication
- **Real-time Messaging**: Send both SMS and MMS messages directly from the CommSync interface
- **Media Support**: Send and receive media attachments in your SMS conversations
- **Multi-account Support**: Connect multiple BulkVS accounts simultaneously
- **Webhook Reception**: Receive incoming messages in real-time via BulkVS webhooks

## Important: Webhook Requirement

**Unlike Twilio and JustCall, BulkVS does not provide an API endpoint to fetch past messages.** To receive incoming messages, you **MUST** configure a webhook in your BulkVS account. Without a webhook, you will only be able to send messages, not receive them.

## Connecting a BulkVS Account

1. Navigate to the SMS section in the sidebar
2. Click "Add BulkVS Account"
3. Enter the following information:
   - **Account Label**: A name to identify this account in CommSync
   - **API Username**: Your BulkVS username (default: <admin@havenmediasolutions.com>)
   - **API Password/Token**: Your BulkVS API token (found in your BulkVS portal under API Credentials)
   - **Phone Number**: The phone number in your BulkVS account (format: +1XXXXXXXXXX)
4. Click "Link Account"

CommSync will validate your credentials by testing the API connection. Once connected, you can immediately start sending messages.

## Configuring the Webhook (Required for Receiving Messages)

To receive incoming messages, follow these steps to set up a webhook in your BulkVS account:

1. Log in to your BulkVS portal
2. Navigate to "Messaging" → "Messaging Webhooks"
3. Create a new webhook with your chosen name
4. Set the Message URL to: `https://commsync.gg/api/bulkvs/webhook`
5. Click "Add" to save the webhook
6. Click on the new webhook in the list to edit it
7. Set "Delivery Receipt" to "false"
8. Assign this webhook to your phone number(s) under "Inbound" → "DIDs – Manage"

Without this webhook configuration, CommSync will not receive any incoming messages from BulkVS.

## Sending Messages

You can send SMS and MMS messages through your BulkVS account:

1. Click the "New Message" button in the SMS interface
2. Select your BulkVS account from the dropdown
3. Enter the recipient's phone number (must include country code, e.g., +1XXXXXXXXXX)
4. Type your message
5. To send media, click the attachment icon and select your file(s)
   - Media must be publicly accessible URLs for BulkVS to process them
6. Click "Send"

CommSync supports all standard BulkVS messaging features:

- Up to 160 characters per SMS message
- MMS messages with media attachments
- Multiple recipient support

## Important Limitations

- **No Message History API**: BulkVS does not provide an API to fetch message history. All past messages must be received through webhooks at the time they were delivered.
- **Campaign Registration Requirement**: To send SMS messages to regular phone numbers (non toll-free), you may need to register a campaign with BulkVS. There is a one-time cost of $30.00 and a $6.00 monthly cost per campaign. Each campaign covers up to 49 telephone numbers.
- **Toll-Free Number Limitations**: BulkVS has volume limits for pending toll-free numbers (daily: 2,000; weekly: 6,000; monthly: 10,000).
- **Media Requirements**: Media attachments for MMS must be publicly accessible URLs to JPEG or PNG files.

## Troubleshooting

If you encounter issues with your BulkVS integration, try these steps:

1. **Verify API Credentials**: Ensure your API username and token are valid
2. **Check Phone Number Format**: The phone number must include the country code (e.g., +1XXXXXXXXXX)
3. **Verify Webhook Setup**: Confirm your webhook is correctly configured in the BulkVS portal
4. **Check Webhook Assignment**: Ensure your number(s) have the webhook applied in "DIDs - Manage"
5. **Campaign Registration**: If sending fails with a campaign-related error, contact BulkVS to register a campaign

For webhook testing, you can manually trigger a test message from your BulkVS dashboard to verify proper reception.

## Security Considerations

- All BulkVS credentials are encrypted before storage
- API keys are never exposed in client-side code
- Webhook endpoints validate that messages are associated with your accounts

## Technical Components

The BulkVS integration consists of:

- `bulkvs-service.ts`: Core service for interacting with the BulkVS API
- `bulkvs-account-dialog.tsx`: UI for adding new BulkVS accounts
- `bulkvs-account-card.tsx`: UI for managing existing BulkVS accounts
- API routes:
  - `/api/bulkvs/link`: Links new BulkVS accounts
  - `/api/bulkvs/account`: Manages existing accounts
  - `/api/bulkvs/send`: Sends messages with proper formatting per BulkVS API
  - `/api/bulkvs/sync`: Updates last sync timestamp (no actual message syncing)
  - `/api/bulkvs/webhook`: Receives incoming webhook events

## API Documentation

For detailed information about the BulkVS API endpoints and formats, see the [BulkVS API Documentation](./bulkvs-docs-api.md).

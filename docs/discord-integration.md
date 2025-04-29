# Discord Integration for CommsSync

## Overview

The Discord integration for CommsSync enables users to connect their Discord accounts and seamlessly manage direct messages and group conversations within the CommsSync interface. This integration focuses exclusively on direct messaging functionality and does not access or interact with Discord servers.

## Features

- **Discord Account Connection**: Users can connect their Discord accounts via OAuth2
- **Direct Message Syncing**: Syncs all direct message (DM) conversations
- **Group Chat Support**: Syncs group DM conversations
- **Real-time Messages**: Receives new messages in near real-time
- **Two-way Communication**: Send and receive messages from within CommsSync
- **Message History**: Access historical Discord messages

## Architecture

The Discord integration consists of three main components:

1. **Web UI**: The frontend components in CommsSync that allow users to manage Discord accounts and interact with messages
2. **API Endpoints**: Backend routes that handle authentication, account management, and message fetching
3. **Middleware Server**: A separate server that maintains persistent connections to Discord for real-time message syncing

### Component Diagram

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│                    │     │                    │     │                    │
│   CommsSync Web    │◄───►│   CommsSync API    │◄───►│ Discord Middleware │
│                    │     │                    │     │                    │
└────────────────────┘     └────────────────────┘     └────────────────────┘
                                    ▲                          ▲
                                    │                          │
                                    ▼                          ▼
                           ┌────────────────────┐     ┌────────────────────┐
                           │                    │     │                    │
                           │      Database      │     │   Discord API      │
                           │                    │     │                    │
                           └────────────────────┘     └────────────────────┘
```

## Setup Instructions

### Prerequisites

1. Create a Discord application at the [Discord Developer Portal](https://discord.com/developers/applications)
2. Set up OAuth2 with the following:
   - Redirect URL: `https://your-commsync-domain.com/api/discord/callback`
   - Scopes: `identify`, `messages.read`, `dm.read`

### Environment Variables

Add the following environment variables to your CommsSync application's `.env` file:

```
# Discord API credentials
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Discord middleware URL
DISCORD_MIDDLEWARE_URL=http://localhost:3001
```

### Middleware Deployment

The Discord middleware server should be deployed separately from the main CommsSync application:

1. Navigate to the `docker/discord-middleware` directory
2. Create a `.env` file based on the `.env.example` template
3. Run the middleware server using Docker Compose:

```bash
docker-compose up -d
```

## User Guide

### Connecting a Discord Account

1. In the CommsSync sidebar, click on "Add Discord Account"
2. Enter a label for the account (e.g., "My Discord")
3. Click "Link Account" and authorize the CommsSync application in the Discord OAuth flow
4. Once authorized, you'll be redirected back to CommsSync with your account connected

### Viewing Discord Messages

Discord messages appear in the main conversation view, similar to other message types in CommsSync:

- Direct messages appear with the recipient's username and avatar
- Group messages appear with the group name and member count
- Messages include text content, embeds, and attachments

### Sending Discord Messages

1. Select a Discord conversation from the sidebar
2. Type your message in the message composer at the bottom of the screen
3. Press Enter or click the Send button

## Database Schema

The Discord integration uses the following database models:

- `DiscordAccount`: Stores user Discord account credentials and connection information
- `DiscordChannel`: Represents a Discord DM or group DM channel
- `DiscordMessage`: Stores individual messages from Discord

## Limitations

The Discord integration has the following limitations:

- Only supports direct messages and group DMs (no server access)
- Rich embeds and certain Discord-specific features may have limited display support
- Message editing is currently one-way (edits made in Discord are synced to CommsSync, but not vice versa)
- Discord threads are not supported

## Troubleshooting

### Common Issues

1. **Account Connection Failures**
   - Ensure your Discord application has the correct redirect URL
   - Check that the required scopes are enabled

2. **Missing Messages**
   - Verify the middleware server is running and connected to Discord
   - Check the middleware server logs for connection errors

3. **Token Expiration**
   - If messages stop syncing, try disconnecting and reconnecting your Discord account

### Logs

- Web application logs can be found in the main CommsSync log files
- Middleware logs are stored in the `logs` directory of the middleware container

## Security Considerations

- Discord OAuth tokens are stored securely in the database
- The middleware server communicates with the database using a dedicated connection
- Only direct messages and group DMs are accessible (no server data)
- User tokens are refreshed automatically to maintain secure connections

## Extending the Integration

To add additional Discord features:

1. Update the Prisma schema with any new data models
2. Extend the Discord service to handle new message types or events
3. Add new API endpoints for the additional functionality
4. Update the UI components to display the new features

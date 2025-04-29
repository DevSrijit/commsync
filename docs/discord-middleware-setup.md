# Discord Integration Fix: Using the Middleware Approach

This document explains the changes made to fix the Discord integration by implementing a middleware approach.

## Problem

The original implementation attempted to use discord.js directly in the Next.js application, which won't work because:

1. discord.js requires Node.js-specific modules like `timers/promises` and `worker_threads`
2. It's not suitable for browser environments
3. It can't maintain persistent connections in serverless environments like Next.js API routes

## Solution

We've implemented a middleware approach where:

1. A separate Node.js server (the Discord middleware) maintains persistent connections to Discord
2. The middleware exposes REST API endpoints for the main application to interact with
3. The main application communicates with the middleware instead of directly with Discord

## Components

### 1. Discord Middleware Server

Located in `middleware/discord-middleware/`, this Node.js Express application:

- Manages discord.js client instances for each user
- Handles real-time message reception from Discord
- Syncs messages to the database
- Exposes REST endpoints for the main application

### 2. Discord Service

Located in `lib/discord-service.ts`, this service:

- Communicates with the middleware server via HTTP
- Provides methods for sending messages, syncing, etc.
- Does not use discord.js directly

### 3. API Routes

New API routes have been created to:

- Register/unregister Discord accounts with the middleware
- Sync messages via the middleware
- Send messages via the middleware

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```
# Discord API credentials
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Discord middleware URL
DISCORD_MIDDLEWARE_URL=http://localhost:3001
```

### 2. Deploy the Discord Middleware

```bash
# Navigate to the middleware directory
cd middleware/discord-middleware

# Create a .env file with the required variables
cat > .env << EOL
PORT=3001
DATABASE_URL=your_database_url
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
EOL

# Start the middleware using Docker
docker-compose up -d
```

### 3. Make sure the main application can reach the middleware

If you're deploying to production, make sure:

1. The middleware is running on a server with a stable connection
2. The `DISCORD_MIDDLEWARE_URL` in your main application points to the correct URL
3. Firewall rules allow communication between your main app and middleware

## How It Works

1. **User Connects Discord Account**:
   - User authorizes CommsSync via Discord OAuth
   - CommsSync saves tokens and registers the account with the middleware

2. **Real-time Message Reception**:
   - Discord middleware maintains websocket connection to Discord
   - When a message arrives, middleware saves it to database
   - CommsSync UI displays messages from database

3. **Sending Messages**:
   - User sends message in CommsSync UI
   - API route calls middleware's send-message endpoint
   - Middleware sends message to Discord and saves to database

## Troubleshooting

### Middleware Connection Issues

If the middleware can't connect to Discord:

- Check Discord token validity
- Verify intents in Discord Developer Portal
- Check the middleware logs

### Communication Issues

If the main app can't communicate with middleware:

- Check network connectivity between servers
- Verify the `DISCORD_MIDDLEWARE_URL` is correct
- Check middleware server is running

### Token Refresh Problems

If tokens aren't refreshing:

- Ensure `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- Check middleware logs for token refresh errors

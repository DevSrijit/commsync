require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChannelType,
} = require("discord.js");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const cluster = require("cluster");
const os = require("os");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const prometheus = require("prom-client");

// Configuration
const MAX_CONCURRENT_CONNECTIONS =
  process.env.MAX_CONCURRENT_CONNECTIONS || 100;
const CONNECTION_POOL_CHECK_INTERVAL = 60 * 1000; // 1 minute
const INACTIVE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const SHARD_COUNT = process.env.SHARD_COUNT || 2;
const NUM_WORKERS = process.env.NUM_WORKERS || os.cpus().length;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Setup logger
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});

// Primary process manages workers
if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Worker code - Each worker runs a server instance
  startServer();
}

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Add a default label which is added to all metrics
prometheus.collectDefaultMetrics({
  register,
  prefix: "discord_middleware_",
  labels: { app: "discord_middleware" },
});

// Define custom metrics
const activeConnectionsGauge = new prometheus.Gauge({
  name: "discord_active_connections",
  help: "Number of active Discord connections",
  labelNames: ["worker_id"],
  registers: [register],
});

const connectionQueueGauge = new prometheus.Gauge({
  name: "discord_connection_queue_length",
  help: "Length of the connection queue",
  labelNames: ["worker_id"],
  registers: [register],
});

const messageProcessingCounter = new prometheus.Counter({
  name: "discord_messages_processed_total",
  help: "Total count of Discord messages processed",
  labelNames: ["worker_id"],
  registers: [register],
});

const messageProcessingErrorCounter = new prometheus.Counter({
  name: "discord_message_processing_errors_total",
  help: "Total count of errors during Discord message processing",
  labelNames: ["worker_id"],
  registers: [register],
});

const syncOperationsCounter = new prometheus.Counter({
  name: "discord_sync_operations_total",
  help: "Total count of Discord sync operations",
  labelNames: ["worker_id", "success"],
  registers: [register],
});

const apiRequestsCounter = new prometheus.Counter({
  name: "discord_api_requests_total",
  help: "Total count of API requests",
  labelNames: ["worker_id", "endpoint", "status"],
  registers: [register],
});

const apiLatencyHistogram = new prometheus.Histogram({
  name: "discord_api_request_duration_seconds",
  help: "Duration of API requests in seconds",
  labelNames: ["worker_id", "endpoint"],
  buckets: prometheus.exponentialBuckets(0.01, 2, 10), // From 10ms to ~10s
  registers: [register],
});

// Function to start a server instance
function startServer() {
  // Initialize Express app
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Initialize Prisma client
  const prisma = new PrismaClient();

  // Configure middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(morgan("combined", { stream: accessLogStream }));

  // Discord client instances
  const discordClients = new Map();
  const connectionQueue = [];
  const activeConnections = new Set();

  // Connection pool management
  let isProcessingQueue = false;

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      activeConnections: discordClients.size,
      queueLength: connectionQueue.length,
      workerId: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  });

  // Process the connection queue
  async function processConnectionQueue() {
    if (isProcessingQueue || connectionQueue.length === 0) {
      return;
    }

    isProcessingQueue = true;

    try {
      // Process queue until we hit the limit or exhaust the queue
      while (
        connectionQueue.length > 0 &&
        activeConnections.size < MAX_CONCURRENT_CONNECTIONS
      ) {
        const { account, resolve, reject } = connectionQueue.shift();
        try {
          const client = await initializeDiscordClient(account);
          resolve(client);
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  }

  // Periodically check and clean up inactive connections
  setInterval(async () => {
    const now = Date.now();
    const staleAccountIds = [];

    // Check for inactive connections
    for (const [accountId, data] of discordClients.entries()) {
      if (now - data.lastActivity > INACTIVE_TIMEOUT) {
        console.log(`Cleaning up inactive connection for account ${accountId}`);
        staleAccountIds.push(accountId);
      }
    }

    // Clean up stale connections
    for (const accountId of staleAccountIds) {
      try {
        const client = discordClients.get(accountId)?.client;
        if (client) {
          client.destroy();
          discordClients.delete(accountId);
          activeConnections.delete(accountId);
        }
      } catch (error) {
        console.error(`Error cleaning up connection for ${accountId}:`, error);
      }
    }

    // Process the queue after cleanup
    processConnectionQueue();
  }, CONNECTION_POOL_CHECK_INTERVAL);

  // Initialize Discord client for an account
  async function initializeDiscordClient(account) {
    // Update last activity timestamp if the client already exists
    if (discordClients.has(account.id)) {
      discordClients.get(account.id).lastActivity = Date.now();
      console.log(`Client for account ${account.id} already exists`);
      return discordClients.get(account.id).client;
    }

    // If we've reached the connection limit, queue this request
    if (activeConnections.size >= MAX_CONCURRENT_CONNECTIONS) {
      console.log(`Connection limit reached. Queueing account ${account.id}`);
      return new Promise((resolve, reject) => {
        connectionQueue.push({ account, resolve, reject });
      });
    }

    console.log(`Initializing Discord client for account ${account.id}`);

    // Create new Discord client with sharding if needed
    const client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.User],
      shards: SHARD_COUNT > 1 ? "auto" : undefined,
      shardCount: SHARD_COUNT > 1 ? SHARD_COUNT : undefined,
    });

    // Set up event handlers
    client.on(Events.ClientReady, async () => {
      console.log(`Discord client ready: ${client.user.tag}`);

      // Sync channels when client is ready
      await syncChannels(client, account);
    });

    client.on(Events.MessageCreate, async (message) => {
      // Only process DMs and group DMs
      if (shouldProcessMessage(message)) {
        await processMessage(message, account);
      }
    });

    client.on(Events.Error, (error) => {
      console.error(`Discord client error for account ${account.id}:`, error);
    });

    // Log in to Discord
    try {
      await client.login(account.accessToken);

      // Add to active connections
      activeConnections.add(account.id);

      // Store client in map with last activity timestamp
      discordClients.set(account.id, {
        client,
        lastActivity: Date.now(),
      });

      return client;
    } catch (error) {
      console.error(`Failed to log in for account ${account.id}:`, error);

      // Check if token has expired
      if (error.message.includes("TOKEN_INVALID")) {
        console.log(
          `Token expired for account ${account.id}, attempting to refresh...`
        );

        try {
          // Try to refresh the token
          const refreshed = await refreshToken(account);
          if (refreshed) {
            // Try again with the new token
            const updatedAccount = await prisma.discordAccount.findUnique({
              where: { id: account.id },
            });

            activeConnections.add(account.id);
            await client.login(updatedAccount.accessToken);

            discordClients.set(account.id, {
              client,
              lastActivity: Date.now(),
            });

            return client;
          }
        } catch (refreshError) {
          console.error(
            `Failed to refresh token for account ${account.id}:`,
            refreshError
          );
        }

        // Mark token as expired in database
        await prisma.discordAccount.update({
          where: { id: account.id },
          data: {
            expiresAt: new Date(0), // Set to a very old date to force refresh
          },
        });
      }

      throw error;
    }
  }

  // Refresh Discord OAuth token
  async function refreshToken(account) {
    try {
      const tokenEndpoint = "https://discord.com/api/oauth2/token";

      const params = new URLSearchParams();
      params.append("client_id", process.env.DISCORD_CLIENT_ID);
      params.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", account.refreshToken);

      const response = await axios.post(tokenEndpoint, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Calculate new expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      // Update account in database
      await prisma.discordAccount.update({
        where: { id: account.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
        },
      });

      console.log(`Token refreshed for account ${account.id}`);
      return true;
    } catch (error) {
      console.error(`Error refreshing token for account ${account.id}:`, error);
      return false;
    }
  }

  // Check if a message should be processed
  function shouldProcessMessage(message) {
    const channel = message.channel;

    // Only process DMs or Group DMs
    return (
      channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM
    );
  }

  // Process an incoming message
  async function processMessage(message, account) {
    try {
      // Skip messages from the bot itself
      if (message.author.id === message.client.user.id) {
        return;
      }

      // Update last activity timestamp for this account's connection
      if (discordClients.has(account.id)) {
        discordClients.get(account.id).lastActivity = Date.now();
      }

      const channelType =
        message.channel.type === ChannelType.DM ? "dm" : "group_dm";

      // Get or create the channel in the database
      let dbChannel = await prisma.discordChannel.findFirst({
        where: {
          discordChannelId: message.channelId,
        },
      });

      if (!dbChannel) {
        // Create the channel
        const channelData = {
          discordChannelId: message.channelId,
          type: channelType,
          name: getChannelName(message),
          recipients: getChannelRecipients(message),
        };

        dbChannel = await prisma.discordChannel.create({
          data: {
            ...channelData,
            discordAccounts: {
              connect: { id: account.id },
            },
          },
        });
      }

      // Create the message in the database
      await prisma.discordMessage.create({
        data: {
          discordMessageId: message.id,
          discordAccountId: account.id,
          channelId: dbChannel.id,
          author: formatAuthor(message),
          content: message.content || "",
          embeds: message.embeds.length > 0 ? message.embeds : undefined,
          attachments:
            message.attachments.size > 0
              ? Array.from(message.attachments.values())
              : undefined,
          timestamp: message.createdAt,
          editedTimestamp: message.editedAt,
        },
      });

      // Update the channel's last message ID and timestamp
      await prisma.discordChannel.update({
        where: { id: dbChannel.id },
        data: {
          lastMessageId: message.id,
          updatedAt: new Date(),
        },
      });

      console.log(`Processed message ${message.id} for account ${account.id}`);

      // Increment the message processing counter
      messageProcessingCounter.inc({ worker_id: process.pid.toString() });
    } catch (error) {
      console.error(`Error processing Discord message:`, error);

      // Increment the error counter
      messageProcessingErrorCounter.inc({ worker_id: process.pid.toString() });
    }
  }

  // Get the display name for a channel
  function getChannelName(message) {
    const channel = message.channel;

    if (channel.type === ChannelType.DM) {
      return channel.recipient?.username || "Direct Message";
    } else if (channel.type === ChannelType.GroupDM) {
      // For group DMs, use the channel name or generate one from recipients
      return channel.name || "Group Message";
    }

    return "Unknown Channel";
  }

  // Get recipients for a channel
  function getChannelRecipients(message) {
    const channel = message.channel;

    if (channel.type === ChannelType.DM) {
      return [
        {
          id: channel.recipient?.id,
          username: channel.recipient?.username,
          avatar: channel.recipient?.avatar,
        },
      ];
    } else if (channel.type === ChannelType.GroupDM) {
      // For group DMs, get all recipients
      const recipients =
        channel.recipients?.map((user) => ({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        })) || [];

      return recipients;
    }

    return [];
  }

  // Format author data for storage
  function formatAuthor(message) {
    return {
      id: message.author.id,
      username: message.author.username,
      avatar: message.author.avatar,
    };
  }

  // Sync channels for an account
  async function syncChannels(client, account) {
    try {
      // Update last activity timestamp
      if (discordClients.has(account.id)) {
        discordClients.get(account.id).lastActivity = Date.now();
      }

      // Fetch DM channels
      const dmChannels = client.channels.cache.filter(
        (channel) =>
          channel.type === ChannelType.DM ||
          channel.type === ChannelType.GroupDM
      );

      console.log(
        `Found ${dmChannels.size} DM channels to sync for account ${account.id}`
      );

      for (const [_, channel] of dmChannels) {
        await syncChannel(channel, account);
      }

      // Update last sync time
      await prisma.discordAccount.update({
        where: { id: account.id },
        data: { lastSync: new Date() },
      });

      // Increment the sync operations counter (success)
      syncOperationsCounter.inc({
        worker_id: process.pid.toString(),
        success: "true",
      });
    } catch (error) {
      console.error(
        `Error syncing Discord channels for account ${account.id}:`,
        error
      );

      // Increment the sync operations counter (failure)
      syncOperationsCounter.inc({
        worker_id: process.pid.toString(),
        success: "false",
      });
    }
  }

  // Sync a single channel
  async function syncChannel(channel, account) {
    try {
      const channelType = channel.type === ChannelType.DM ? "dm" : "group_dm";
      let channelName = "Unknown Channel";
      let recipients = [];

      // Get channel name and recipients based on channel type
      if (channel.type === ChannelType.DM) {
        channelName = channel.recipient?.username || "Direct Message";
        recipients = [
          {
            id: channel.recipient?.id,
            username: channel.recipient?.username,
            avatar: channel.recipient?.avatar,
          },
        ];
      } else if (channel.type === ChannelType.GroupDM) {
        channelName = channel.name || "Group Message";
        recipients =
          channel.recipients?.map((user) => ({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
          })) || [];
      }

      // Get or create the channel in the database
      let dbChannel = await prisma.discordChannel.findFirst({
        where: {
          discordChannelId: channel.id,
        },
      });

      if (!dbChannel) {
        // Create the channel
        dbChannel = await prisma.discordChannel.create({
          data: {
            discordChannelId: channel.id,
            type: channelType,
            name: channelName,
            recipients: recipients,
            discordAccounts: {
              connect: { id: account.id },
            },
          },
        });
      }

      // Fetch messages from this channel (limit to 50 for initial sync)
      try {
        const messages = await channel.messages.fetch({ limit: 50 });

        for (const [_, message] of messages) {
          // Skip messages from the bot itself
          if (message.author.id === channel.client.user.id) {
            continue;
          }

          // Check if message already exists
          const existingMessage = await prisma.discordMessage.findFirst({
            where: {
              discordMessageId: message.id,
              channelId: dbChannel.id,
            },
          });

          if (!existingMessage) {
            // Create the message in the database
            await prisma.discordMessage.create({
              data: {
                discordMessageId: message.id,
                discordAccountId: account.id,
                channelId: dbChannel.id,
                author: {
                  id: message.author.id,
                  username: message.author.username,
                  avatar: message.author.avatar,
                },
                content: message.content || "",
                embeds: message.embeds.length > 0 ? message.embeds : undefined,
                attachments:
                  message.attachments.size > 0
                    ? Array.from(message.attachments.values())
                    : undefined,
                timestamp: message.createdAt,
                editedTimestamp: message.editedAt,
              },
            });
          }
        }

        // Update the channel's last message ID
        if (messages.size > 0) {
          const lastMessage = messages.first();
          await prisma.discordChannel.update({
            where: { id: dbChannel.id },
            data: {
              lastMessageId: lastMessage?.id,
              updatedAt: new Date(),
            },
          });
        }
      } catch (error) {
        console.error(
          `Error fetching messages for channel ${channel.id}:`,
          error
        );
      }
    } catch (error) {
      console.error(`Error syncing Discord channel ${channel.id}:`, error);
    }
  }

  // REST API endpoints

  // Register a Discord account with the middleware
  app.post("/register", async (req, res) => {
    try {
      const { accountId, accessToken, refreshToken, expiresAt, discordUserId } =
        req.body;

      if (
        !accountId ||
        !accessToken ||
        !refreshToken ||
        !expiresAt ||
        !discordUserId
      ) {
        return res.status(400).json({
          error:
            "Missing required fields: accountId, accessToken, refreshToken, expiresAt, discordUserId",
        });
      }

      // Check if account is already registered
      if (discordClients.has(accountId)) {
        // Disconnect existing client
        const existingClient = discordClients.get(accountId).client;
        existingClient.destroy();
        discordClients.delete(accountId);
        activeConnections.delete(accountId);
      }

      const account = {
        id: accountId,
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAt),
        discordUserId,
      };

      // Initialize Discord client for this account
      try {
        await initializeDiscordClient(account);
        res.json({
          success: true,
          message: "Discord account registered successfully",
        });
      } catch (error) {
        res.status(500).json({
          error: `Failed to initialize Discord client: ${error.message}`,
        });
      }
    } catch (error) {
      console.error("Error registering Discord account:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unregister a Discord account from the middleware
  app.post("/unregister", async (req, res) => {
    try {
      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      // Check if client exists
      if (discordClients.has(accountId)) {
        // Disconnect client
        const client = discordClients.get(accountId).client;
        client.destroy();
        discordClients.delete(accountId);
        activeConnections.delete(accountId);

        console.log(`Discord client for account ${accountId} unregistered`);
        res.json({
          success: true,
          message: "Discord account unregistered successfully",
        });
      } else {
        res.status(404).json({ error: "Account not registered" });
      }
    } catch (error) {
      console.error("Error unregistering Discord account:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync channels endpoint
  app.post("/sync", async (req, res) => {
    try {
      const { accountId } = req.body;

      if (!accountId) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      // Get account from database
      const account = await prisma.discordAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Get Discord client
      let client;

      if (discordClients.has(accountId)) {
        // Update last activity timestamp
        discordClients.get(accountId).lastActivity = Date.now();
        client = discordClients.get(accountId).client;
      } else {
        // Initialize client if not already done
        try {
          client = await initializeDiscordClient(account);
        } catch (error) {
          return res.status(500).json({
            error: `Failed to initialize Discord client: ${error.message}`,
          });
        }
      }

      // Sync channels
      await syncChannels(client, account);

      res.json({ success: true, message: "Channels synced successfully" });
    } catch (error) {
      console.error("Error syncing channels:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send message endpoint
  app.post("/send-message", async (req, res) => {
    try {
      const { accountId, discordChannelId, content } = req.body;

      if (!accountId || !discordChannelId || !content) {
        return res.status(400).json({
          error: "Account ID, Discord channel ID, and content are required",
        });
      }

      // Get account from database
      const account = await prisma.discordAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Get Discord client
      let client;

      if (discordClients.has(accountId)) {
        // Update last activity timestamp
        discordClients.get(accountId).lastActivity = Date.now();
        client = discordClients.get(accountId).client;
      } else {
        // Initialize client if not already done
        try {
          client = await initializeDiscordClient(account);
        } catch (error) {
          return res.status(500).json({
            error: `Failed to initialize Discord client: ${error.message}`,
          });
        }
      }

      // Get Discord channel
      const discordChannel = await client.channels.fetch(discordChannelId);

      if (!discordChannel) {
        return res.status(404).json({ error: "Discord channel not found" });
      }

      // Find db channel
      const dbChannel = await prisma.discordChannel.findFirst({
        where: {
          discordChannelId: discordChannelId,
        },
      });

      if (!dbChannel) {
        return res.status(404).json({ error: "Channel not found in database" });
      }

      // Send message
      const sentMessage = await discordChannel.send(content);

      // Format message for response
      const messageData = {
        id: sentMessage.id,
        content: sentMessage.content,
        author: {
          id: client.user.id,
          username: client.user.username,
          avatar: client.user.avatar,
        },
        timestamp: sentMessage.createdTimestamp,
        editedTimestamp: sentMessage.editedTimestamp,
        embeds: sentMessage.embeds,
        attachments: Array.from(sentMessage.attachments.values()),
      };

      // Store message in database
      await prisma.discordMessage.create({
        data: {
          discordMessageId: sentMessage.id,
          discordAccountId: accountId,
          channelId: dbChannel.id,
          author: messageData.author,
          content: sentMessage.content || "",
          embeds:
            sentMessage.embeds.length > 0 ? sentMessage.embeds : undefined,
          attachments:
            sentMessage.attachments.size > 0
              ? Array.from(sentMessage.attachments.values())
              : undefined,
          timestamp: sentMessage.createdAt,
          editedTimestamp: sentMessage.editedAt,
          isRead: true, // Mark as read since we sent it
        },
      });

      // Update channel's last message ID
      await prisma.discordChannel.update({
        where: { id: dbChannel.id },
        data: {
          lastMessageId: sentMessage.id,
          updatedAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: messageData,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Additional health metrics endpoint
  app.get("/metrics", async (req, res) => {
    try {
      // Update metrics before serving
      activeConnectionsGauge.set(
        { worker_id: process.pid.toString() },
        activeConnections.size
      );
      connectionQueueGauge.set(
        { worker_id: process.pid.toString() },
        connectionQueue.length
      );

      // Return all metrics
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      console.error("Error generating metrics:", error);
      res.status(500).end();
    }
  });

  // Load all active accounts on startup
  async function loadActiveAccounts() {
    try {
      // Get all accounts that have valid tokens
      const accounts = await prisma.discordAccount.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      console.log(`Loading ${accounts.length} active Discord accounts`);

      // Batch process accounts in smaller groups to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < accounts.length; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);

        // Wait for all in this batch to complete
        await Promise.allSettled(
          batch.map(async (account) => {
            try {
              await initializeDiscordClient(account);
            } catch (error) {
              console.error(
                `Failed to initialize client for account ${account.id}:`,
                error
              );
            }
          })
        );

        // Brief pause between batches
        if (i + batchSize < accounts.length) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("Error loading active accounts:", error);
    }
  }

  // Cleanup function to disconnect all clients
  function cleanup() {
    console.log("Shutting down Discord middleware server...");

    for (const [accountId, data] of discordClients.entries()) {
      console.log(`Disconnecting client for account ${accountId}`);
      data.client.destroy();
    }

    // Clear maps and sets
    discordClients.clear();
    activeConnections.clear();

    // Close Prisma connection
    prisma.$disconnect();
  }

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  // Start server
  app.listen(PORT, async () => {
    console.log(
      `Discord middleware server running on port ${PORT} (Worker ${process.pid})`
    );

    // Load active accounts
    await loadActiveAccounts();

    // Start processing the connection queue periodically
    setInterval(processConnectionQueue, 5000);
  });
}

// Add a middleware to track API latency and requests
app.use((req, res, next) => {
  const start = Date.now();

  // Record the endpoint
  const endpoint = req.path;

  // When the response is finished
  res.on("finish", () => {
    // Record the request
    apiRequestsCounter.inc({
      worker_id: process.pid.toString(),
      endpoint,
      status: res.statusCode.toString(),
    });

    // Record the latency
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    apiLatencyHistogram.observe(
      {
        worker_id: process.pid.toString(),
        endpoint,
      },
      duration
    );
  });

  next();
});

# Discord Middleware for CommsSync

## Overview

The Discord Middleware for CommsSync is a robust service that handles Discord bot connections, events, and interactions for the CommsSync platform. It provides:

- Persistent connections to Discord via the Discord.js library
- Real-time message handling and event processing
- REST API for interacting with Discord functionality
- Rate limit management and queue processing
- Comprehensive monitoring and metrics

## Architecture

The middleware implements a scalable architecture designed for reliability:

- Worker processes for managing Discord connections
- Connection pooling for efficient resource utilization
- Automatic cleanup of stale connections
- Discord sharding to handle large server loads
- Prometheus metrics for monitoring

## Prerequisites

- Node.js v18 or higher
- Docker and Docker Compose for containerized deployment
- PostgreSQL database access
- Discord bot credentials (Token, Client ID, Client Secret)
- Access to Discord Developer Portal

## Environment Variables

### Server Settings

```
PORT=3001                           # API port for the middleware
DATABASE_URL=postgres://user:pass@host:port/db  # PostgreSQL connection string
DISCORD_CLIENT_ID=your_client_id    # Discord application client ID
DISCORD_CLIENT_SECRET=your_secret   # Discord application client secret
```

### Performance Tuning

```
MAX_CONCURRENT_CONNECTIONS=100      # Maximum number of Discord connections
SHARD_COUNT=2                       # Number of Discord shards
NUM_WORKERS=2                       # Number of worker processes
```

### Monitoring

```
GRAFANA_CLOUD_PROM_URL=https://prometheus-url    # Hosted Prometheus endpoint URL
GRAFANA_CLOUD_PROM_USERNAME=username             # Prometheus auth username
GRAFANA_CLOUD_PROM_API_KEY=api_key               # Prometheus API key
```

### Database

For PostgreSQL connection details, set DATABASE_URL in the format:

```
DATABASE_URL=postgres://username:password@hostname:port/database
```

## Installation

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with required environment variables
4. Start the service: `npm run dev`

### Docker Deployment

1. Ensure Docker and Docker Compose are installed
2. Set environment variables in a `.env` file
3. Start the containers: `docker-compose up -d`

## Monitoring Setup (External Grafana)

### Configuring Prometheus to Push Metrics to Hosted Grafana

The Docker Compose file includes a Prometheus container that can be configured to push metrics to your hosted Grafana instance. Follow these steps to set up the integration:

1. **Get Credentials from Your Hosted Grafana**:
   - Log in to your hosted Grafana instance
   - Navigate to Connections → Data Sources → Add new data source → Prometheus
   - Find the "Remote Write" configuration section
   - Note the URL, username, and API key provided

2. **Configure Environment Variables**:
   Add these variables to your `.env` file:

   ```
   GRAFANA_CLOUD_PROM_URL=https://your-prometheus-endpoint
   GRAFANA_CLOUD_PROM_USERNAME=your-username
   GRAFANA_CLOUD_PROM_API_KEY=your-api-key
   ```

3. **Verify Configuration**:
   - The `prometheus.yml` file automatically uses these variables in the `remote_write` section
   - The configuration includes filtering to only send relevant Discord metrics
   - Check your Grafana dashboard to confirm metrics are being received

4. **Creating Dashboards**:
   - Import our pre-configured dashboard JSON (available in the `grafana-dashboards` directory)
   - Or create custom dashboards using the available metrics
   - Recommended panels include: connection count, message throughput, API response times, and error rates

## Metrics

The middleware exposes the following metrics at the `/metrics` endpoint:

| Metric Name | Type | Description |
|-------------|------|-------------|
| discord_connections_total | Gauge | Current number of active Discord connections |
| discord_messages_received_total | Counter | Total number of Discord messages received |
| discord_messages_sent_total | Counter | Total number of Discord messages sent |
| discord_errors_total | Counter | Count of Discord-related errors |
| discord_api_latency_ms | Histogram | Discord API latency in milliseconds |
| discord_rate_limits_hit_total | Counter | Number of Discord rate limits encountered |
| discord_guild_count | Gauge | Number of guilds/servers the bot is connected to |
| discord_user_count | Gauge | Number of users across all connected servers |
| discord_channel_count | Gauge | Number of channels across all connected servers |
| discord_shards_online | Gauge | Number of Discord shards currently online |
| discord_worker_memory_usage_bytes | Gauge | Memory usage per worker process |
| discord_event_processing_time_ms | Histogram | Time taken to process Discord events |

## Infrastructure and Networking

### Network Requirements

#### Inbound Traffic

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 3001 | TCP | CommsSync Services | API access for the middleware |
| 9090 | TCP | Monitoring systems | Prometheus metrics endpoint (optional) |

#### Outbound Traffic

| Destination | Port | Protocol | Purpose |
|-------------|------|----------|---------|
| discord.com | 443 | TCP/HTTPS | Discord API and Gateway connections |
| gateway.discord.gg | 443 | TCP/WSS | Discord WebSocket connections |
| *.discord.media | 443 | TCP/HTTPS | Discord media content |

### Hardware Requirements

| Scale | Users | Recommended Resources | Notes |
|-------|-------|------------------------|-------|
| Small | <10K | 2 vCPUs, 2GB RAM | Suitable for development and testing |
| Medium | 10K-100K | 4 vCPUs, 4GB RAM | Standard production deployment |
| Large | 100K-500K | 8 vCPUs, 8GB RAM | High-traffic deployment |
| Enterprise | >500K | 16+ vCPUs, 16GB+ RAM | Requires advanced sharding setup |

### Networking Considerations

1. **Load Balancing**:
   - For high-availability setups, deploy behind a load balancer
   - Ensure sticky sessions are enabled if using multiple instances
   - Configure health checks to use the `/health` endpoint

2. **Firewall Configuration**:
   - Allow outbound connections to Discord domains
   - Allow inbound traffic only on necessary ports
   - Implement rate limiting at the network level for API endpoints

3. **SSL Termination**:
   - Use a reverse proxy like Nginx or a cloud load balancer for SSL termination
   - Enforce HTTPS for all API traffic
   - Redirect HTTP requests to HTTPS

4. **Network Latency**:
   - Deploy in regions close to your primary users to minimize latency
   - For global deployments, consider multiple regional instances with appropriate sharding

## Discord Sharding

### Advanced Sharding Configuration

Sharding is essential for bots that are in a large number of Discord servers. Each shard is responsible for a subset of guilds.

#### Automatic Sharding

The middleware uses Discord.js's AutoShardingManager by default:

```javascript
// Configured via environment variables
SHARD_COUNT=2         // Number of shards to use
NUM_WORKERS=2         // Number of worker processes
```

#### Manual Sharding Configuration

For more control, you can configure specific shard ranges:

1. **Calculating Optimal Shard Count**:
   - Discord recommends 1 shard per 2500 guilds
   - Formula: `Math.ceil(guildCount / 2500)`

2. **Setting Up Sharding Ranges**:
   For distributing across multiple instances, set these additional variables:

   ```
   SHARD_START=0      // Starting shard ID for this instance
   SHARD_END=4        // Ending shard ID for this instance
   TOTAL_SHARDS=10    // Total shards across all instances
   ```

3. **Multi-Instance Sharding**:
   - Example for 3 instances with 9 total shards:
     - Instance 1: `SHARD_START=0, SHARD_END=2, TOTAL_SHARDS=9`
     - Instance 2: `SHARD_START=3, SHARD_END=5, TOTAL_SHARDS=9`
     - Instance 3: `SHARD_START=6, SHARD_END=8, TOTAL_SHARDS=9`

4. **Optimal Worker Distribution**:
   - For best performance, set `NUM_WORKERS` to match the number of shards
   - For resource-constrained environments, use `NUM_WORKERS = availableCPUs - 1`

## Operational Management

### Health Checks

The middleware provides a `/health` endpoint that returns:

- Overall service status
- Database connection health
- Discord API connection status
- Shard statuses
- Resource utilization metrics

Sample health check response:

```json
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": 86400,
  "discord": {
    "connected": true,
    "apiLatency": 42,
    "shardsOnline": 2,
    "totalShards": 2
  },
  "database": {
    "connected": true,
    "latency": 5
  },
  "memory": {
    "usage": 512000000,
    "limit": 2000000000
  }
}
```

### Log Management

Logs are written to the `logs` directory with JSON formatting for easy parsing:

1. **Log Levels**:
   - `error`: Critical issues requiring immediate attention
   - `warn`: Potential issues or unusual events
   - `info`: Normal operational information
   - `debug`: Detailed information for troubleshooting

2. **Log Rotation**:
   - Logs are automatically rotated daily
   - Maximum of 14 days of logs are retained by default
   - Configure retention period with `LOG_RETENTION_DAYS` environment variable

3. **External Log Aggregation**:
   - Compatible with ELK Stack, Datadog, and other log aggregation services
   - Can output to stdout for container orchestration platforms
   - Enable by setting `LOG_TO_STDOUT=true`

### Backup and Restore

The middleware stores critical data in PostgreSQL:

1. **Regular Backups**:
   - Schedule PostgreSQL dumps using cron or your backup solution
   - Example backup command:

     ```
     pg_dump -U username -d database -F c -f backup.dump
     ```

2. **Restore Process**:
   - To restore from a backup:

     ```
     pg_restore -U username -d database -F c backup.dump
     ```

3. **Configuration Backup**:
   - Keep `.env` files and `docker-compose.yml` configurations in version control
   - Document environment-specific settings separately

### Scaling Considerations

1. **Vertical Scaling**:
   - Increase CPU and memory allocations in `docker-compose.yml`
   - Monitor resource usage to determine when to scale

2. **Horizontal Scaling**:
   - Deploy multiple instances with appropriate sharding configuration
   - Use a load balancer to distribute API requests
   - Ensure database can handle increased connection load

3. **Auto-scaling**:
   - Use container orchestration platforms like Kubernetes
   - Configure auto-scaling based on CPU usage or connection count metrics
   - Implement proper liveness and readiness probes

### High Availability Setup

1. **Multi-Region Deployment**:
   - Deploy instances in multiple geographical regions
   - Configure appropriate sharding across regions
   - Use global DNS routing for region failover

2. **Database HA**:
   - Use PostgreSQL replication with failover
   - Consider managed database services for automatic HA
   - Configure connection pooling to handle reconnections gracefully

3. **Disaster Recovery**:
   - Maintain regular backups in multiple locations
   - Document recovery procedures for different failure scenarios
   - Test recovery processes regularly

## Security Considerations

1. **Credential Management**:
   - Never store Discord tokens or API keys in code
   - Use environment variables or secure secret management
   - Rotate credentials periodically

2. **API Security**:
   - Implement rate limiting for API endpoints
   - Use API keys or JWT authentication for all routes
   - Validate and sanitize all input data

3. **Network Security**:
   - Use HTTPS for all communications
   - Restrict network access using firewalls
   - Implement proper CORS policies for browser access

4. **Data Protection**:
   - Encrypt sensitive data at rest
   - Implement proper access controls for user data
   - Comply with relevant data protection regulations (GDPR, CCPA, etc.)

## Troubleshooting

### Common Issues

1. **Connection Failures**:
   - Check Discord API status: <https://discordstatus.com/>
   - Verify credentials in environment variables
   - Ensure outbound connections to Discord domains are allowed

2. **Performance Problems**:
   - Check resource utilization in container stats
   - Monitor connection count vs. configured limits
   - Verify database connection pool settings

3. **Memory Leaks**:
   - Monitor memory usage over time
   - Check for increasing connection counts without cleanup
   - Consider implementing automatic service restarts

### Diagnostic Commands

From the container:

```bash
# Check service logs
docker logs discord-middleware

# View real-time metrics
curl http://localhost:3001/metrics

# Check service health
curl http://localhost:3001/health

# Verify Discord connection status
docker exec discord-middleware npm run status

# Debug mode (restart with debugging)
docker-compose down
DEBUG=discord-middleware:* docker-compose up -d
```

### Performance Tuning

1. **Connection Pool Sizing**:
   - Start with `MAX_CONCURRENT_CONNECTIONS = NUM_WORKERS * 50`
   - Monitor connection usage and adjust accordingly
   - Increase if you see connection wait times in metrics

2. **Worker Processes**:
   - Optimal setting is typically `NUM_WORKERS = available_cpus - 1`
   - For memory-constrained environments, reduce worker count
   - Monitor CPU usage per worker to find bottlenecks

3. **Sharding Strategy**:
   - For under 2500 guilds, a single shard is sufficient
   - Above that, follow Discord's recommendation of 1 shard per 2500 guilds
   - Distribute shards evenly across workers

4. **Database Optimization**:
   - Add indexes for frequently queried fields
   - Configure appropriate connection pool sizes
   - Consider read replicas for heavy query loads

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Discord API connection failed | Check network connectivity and credentials |
| E002 | Failed to authenticate with Discord | Verify bot token is valid and has correct permissions |
| E003 | Exceeded rate limits | Implement backoff strategy or reduce request frequency |
| E004 | Database connection error | Check DATABASE_URL and database server status |
| E005 | Worker process crashed | Check logs for errors and restart service |
| E006 | Insufficient permissions | Ensure bot has required permissions in Discord |
| E007 | Invalid shard configuration | Verify SHARD_COUNT and related settings |
| E008 | Memory limit exceeded | Increase container memory allocation |
| E009 | Disk space full | Clean up logs or increase storage allocation |
| E010 | Connection pool exhausted | Increase MAX_CONCURRENT_CONNECTIONS |

## Database Configuration

This service uses the same database as the main CommsSync application. The Prisma schema in this directory is a copy of the main schema to ensure consistent modeling.

## Environment Setup

1. Copy `.env.example` to `.env` and fill in the required variables:

```bash
cp .env.example .env
```

2. Set the `DATABASE_URL` to point to the same database as your main CommsSync application.

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

## Docker Deployment

```bash
# Build and start with docker-compose
docker-compose up -d
```

## Prisma Schema Updates

When the main application's schema changes, you'll need to update the schema in this directory:

1. Copy the updated schema from the main application
2. Run `npx prisma generate` to update the client

## Connection to Main Application

This middleware exposes REST APIs that the main CommsSync application can use to:

- Register Discord accounts
- Send messages
- Sync channels
- Query metrics

The data is stored in the shared database and can be accessed by both applications.

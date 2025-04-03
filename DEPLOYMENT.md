# Commsync Deployment Guide

This document provides detailed instructions for deploying the Commsync application using Docker and Bun on a DigitalOcean server.

## Prerequisites

- DigitalOcean server with Ubuntu 22.04 LTS
- Docker and Docker Compose installed
- Nginx installed and configured
- PostgreSQL database
- Domain name (commsync.havenmediasolutions.com) pointing to your server
- SSL certificates (preferably from Let's Encrypt)

## Server Setup

### 1. Install Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add current user to docker group
sudo usermod -aG docker $USER
```

### 2. Configure Firewall

```bash
# Install UFW if not already installed
sudo apt install ufw -y

# Configure firewall rules
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Application Deployment

### 1. Prepare Deployment Files

Create a directory for the application:

```bash
mkdir -p /opt/commsync
cd /opt/commsync
```

Copy the following files to the server:

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf`
- `deploy.sh`
- `.env` (with production credentials)

### 2. Configure Environment Variables

Create a `.env` file with the following structure (replace with your actual values):

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/database?schema=public"

# NextAuth Configuration
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="https://commsync.havenmediasolutions.com"

# Other Environment Variables
# ... (add all other required environment variables)
```

### 3. Configure Nginx

```bash
# Copy Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/commsync.havenmediasolutions.com

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/commsync.havenmediasolutions.com /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 4. Deploy Application

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Architecture Overview

The deployment architecture consists of:

1. **Nginx** (Port 443)
   - Handles SSL termination
   - Reverse proxies to the application
   - Redirects HTTP to HTTPS

2. **Docker Container** (Port 8443)
   - Runs the Bun application
   - Exposes the application on port 8443
   - Connects to the PostgreSQL database

3. **PostgreSQL Database**
   - Hosted on the server
   - Accessed by the application container

## Health Checks

The application includes a health check endpoint at `/api/health` that:

- Verifies database connectivity
- Returns application status
- Used by Docker for container health monitoring

## Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run database migrations if needed
docker-compose exec app bunx prisma migrate deploy
```

### Monitoring

Check application status:

```bash
# View container status
docker-compose ps

# View logs
docker-compose logs -f app
```

### Backup and Recovery

#### Database Backup

```bash
# Create backup
pg_dump -U username -d database > backup.sql

# Restore from backup
psql -U username -d database < backup.sql
```

#### Application Data Backup

```bash
# Backup Docker volumes
docker run --rm -v commsync_app-data:/volume -v /backup:/backup alpine tar -czf /backup/app-data-backup.tar.gz -C /volume ./
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Check if port 8443 is in use: `sudo lsof -i :8443`
   - Free up the port if needed

2. **Database Connection Issues**
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check connection string in `.env`
   - Ensure PostgreSQL user has correct permissions

3. **SSL Certificate Issues**
   - Verify certificate paths in Nginx config
   - Check certificate expiration
   - Renew certificates if needed: `sudo certbot renew`

### Logs

View application logs:

```bash
docker-compose logs -f app
```

View Nginx logs:

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Security Considerations

1. **Environment Variables**
   - Keep `.env` file secure
   - Use strong passwords and secrets
   - Rotate credentials regularly

2. **Network Security**
   - Firewall rules are properly configured
   - Only necessary ports are exposed
   - SSL/TLS is properly configured

3. **Application Security**
   - Regular updates and patches
   - Security headers in Nginx
   - Proper error handling

## Support

For deployment issues or questions:

1. Check the logs for error messages
2. Verify all configuration files
3. Ensure all prerequisites are met
4. Contact the development team if issues persist

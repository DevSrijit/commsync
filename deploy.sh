#!/bin/bash

# Exit on error
set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required ports are available
if lsof -i :8443 > /dev/null 2>&1; then
    echo "Port 8443 is already in use. Please free up the port and try again."
    exit 1
fi

# Build and start the containers
echo "Building and starting containers..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8443/api/health > /dev/null; then
        echo "Application is up and running!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Application failed to start within the expected time"
        docker-compose logs app
        exit 1
    fi
    sleep 2
done

# Run database migrations
echo "Running database migrations..."
docker-compose exec app bunx prisma migrate deploy

# Check if the application is running
echo "Checking application status..."
if ! curl -s http://localhost:8443/api/health > /dev/null; then
    echo "Application health check failed"
    docker-compose logs app
    exit 1
fi

echo "Deployment completed successfully!"
echo "Please ensure your existing Nginx configuration includes the provided nginx.conf"
echo "Also ensure your PostgreSQL connection details in .env match your existing database"

# Display container status
echo -e "\nContainer Status:"
docker-compose ps 
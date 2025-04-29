#!/bin/bash
# Script to setup connection to hosted Grafana

# Check if .env file exists, create if not
if [ ! -f .env ]; then
    touch .env
    echo "Created .env file"
fi

# Prompt for Grafana Cloud details
read -p "Enter your Grafana Cloud Prometheus URL (e.g., https://prometheus-prod-10-prod-us-central-0.grafana.net/api/prom/push): " grafana_url
read -p "Enter your Grafana Cloud Prometheus username (usually a numeric ID): " grafana_username
read -p "Enter your Grafana Cloud API key: " grafana_api_key

# Append/update variables in .env file
grep -q "GRAFANA_CLOUD_PROM_URL" .env && \
    sed -i "s|GRAFANA_CLOUD_PROM_URL=.*|GRAFANA_CLOUD_PROM_URL=$grafana_url|" .env || \
    echo "GRAFANA_CLOUD_PROM_URL=$grafana_url" >> .env

grep -q "GRAFANA_CLOUD_PROM_USERNAME" .env && \
    sed -i "s|GRAFANA_CLOUD_PROM_USERNAME=.*|GRAFANA_CLOUD_PROM_USERNAME=$grafana_username|" .env || \
    echo "GRAFANA_CLOUD_PROM_USERNAME=$grafana_username" >> .env

grep -q "GRAFANA_CLOUD_PROM_API_KEY" .env && \
    sed -i "s|GRAFANA_CLOUD_PROM_API_KEY=.*|GRAFANA_CLOUD_PROM_API_KEY=$grafana_api_key|" .env || \
    echo "GRAFANA_CLOUD_PROM_API_KEY=$grafana_api_key" >> .env

echo "Grafana Cloud configuration updated in .env file"
echo "You can now run 'docker-compose up -d' to apply the changes"

# Make executable
chmod +x setup-grafana.sh 
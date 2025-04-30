FROM oven/bun:latest

WORKDIR /app

# Install dependencies
COPY package.json prisma ./
RUN bun install --production

# Generate Prisma client
RUN bunx prisma generate --no-engine

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "start"] 
FROM oven/bun:latest

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "start"] 
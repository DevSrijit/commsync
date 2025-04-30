require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not defined!");
  console.error("Please set DATABASE_URL in your .env file or environment");
  process.exit(1);
}

// Timing middleware for query performance monitoring
const timingMiddleware = {
  name: "timing",
  async middleware(params, next) {
    const start = Date.now();
    const result = await next(params);
    const end = Date.now();
    const time = end - start;

    // Only log slow queries (>100ms) in non-production environments
    if (process.env.NODE_ENV !== "production" && time > 100) {
      console.log(`[PRISMA] (${time}ms) ${params.model}.${params.action}`);
    }

    return result;
  },
};

// Initialize PrismaClient with query timing
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
}).$extends({
  query: timingMiddleware,
});

module.exports = prisma;

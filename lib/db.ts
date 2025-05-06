import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Check if the environment is browser
const isBrowser = typeof window !== "undefined";

// Timing middleware for query performance monitoring
const timingMiddleware = {
  name: "timing",
  async middleware(params: any, next: any) {
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

// Only instantiate PrismaClient if we're not in a browser
export const db = isBrowser
  ? (null as any) // Return null in browser environments
  : globalThis.prisma ||
    new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Set log levels for development environment
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    })

if (process.env.NODE_ENV !== "production" && !isBrowser) globalThis.prisma = db;

// Export a warning function to notify when this module is imported in client components
export const warnIfClient = () => {
  if (isBrowser) {
    console.warn(
      "Attempted to access database client in browser environment. This is not supported."
    );
    return true;
  }
  return false;
};

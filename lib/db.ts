import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
declare global {
  var prisma: PrismaClient | undefined;
}

// Check if the environment is browser
const isBrowser = typeof window !== "undefined";

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
    }).$extends(withAccelerate());

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

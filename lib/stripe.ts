import Stripe from "stripe";

// Ensure this code only runs on the server side
let stripe: Stripe | undefined;

if (typeof window === 'undefined') {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }

  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}

// Plan configurations with shared limits across all users
export const STRIPE_PLANS = {
  lite: {
    name: "Lite",
    priceId: process.env.STRIPE_LITE_PRICE_ID,
    limits: {
      maxUsers: 1,
      maxStorage: 100, // MB per user
      maxConnections: 6, // per user
      totalStorage: 100, // MB total
      totalConnections: 6, // total
      totalAiCredits: 25,
    },
  },
  standard: {
    name: "Standard",
    priceId: process.env.STRIPE_STANDARD_PRICE_ID,
    limits: {
      maxUsers: 3,
      maxStorage: 333, // MB per user (~1GB / 3 users)
      maxConnections: 10, // per user
      totalStorage: 1000, // MB (1GB) total
      totalConnections: 30, // total
      totalAiCredits: 300,
    },
  },
  business: {
    name: "Business",
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    limits: {
      maxUsers: 8,
      maxStorage: 640, // MB per user (~5GB / 8 users)
      maxConnections: 12, // per user
      totalStorage: 5120, // MB (5GB) total
      totalConnections: 100, // total
      totalAiCredits: 1000,
    },
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS;

export { stripe };

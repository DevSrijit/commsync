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
      maxStorage: 500, // MB per user
      maxConnections: 10, // per user
      totalStorage: 500, // MB (500MB per user)
      totalConnections: 10, // total
      totalAiCredits: 100, // 100 per user
    },
  },
  business: {
    name: "Business",
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    limits: {
      maxUsers: 8,
      maxStorage: 1024, // MB per user
      maxConnections: 20, // per user
      totalStorage: 1024, // MB (1GB per user)
      totalConnections: 20, // total
      totalAiCredits: 200, // 200 per user
    },
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS;

export { stripe };

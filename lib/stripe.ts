import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

// Plan configurations with shared limits across all users
export const STRIPE_PLANS = {
  lite: {
    name: 'Lite',
    priceId: process.env.STRIPE_LITE_PRICE_ID,
    limits: {
      maxUsers: 1,
      totalStorage: 100, // MB
      totalConnections: 6,
      totalAiCredits: 25,
    },
  },
  standard: {
    name: 'Standard',
    priceId: process.env.STRIPE_STANDARD_PRICE_ID,
    limits: {
      maxUsers: 3,
      totalStorage: 1000, // MB (1GB)
      totalConnections: 30,
      totalAiCredits: 300,
    },
  },
  business: {
    name: 'Business',
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    limits: {
      maxUsers: 8,
      totalStorage: 5120, // MB (5GB)
      totalConnections: 100,
      totalAiCredits: 1000,
    },
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS; 
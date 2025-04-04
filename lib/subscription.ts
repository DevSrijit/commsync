import { Subscription, Organization, User } from "@prisma/client";
import { db } from "@/lib/db";
import { PlanType, STRIPE_PLANS } from "@/lib/stripe";
import { Prisma } from "@prisma/client";

// Structured logger for consistent format
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === "true") {
      console.log(`[SUBSCRIPTION] ${message}`, data ? data : "");
    }
  },
};

// Local storage keys
const STORAGE_KEYS = {
  SUBSCRIPTION_DATA: "commsync_subscription_data",
  LAST_UPDATED: "commsync_subscription_last_updated",
};

// Subscription data interface
export interface StoredSubscriptionData {
  id: string;
  status: string;
  planType: string;
  organizationId: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  hasTrialEnded?: boolean;
  lastUpdated: number;
  // Usage data
  usedStorage: number;
  totalStorage: number;
  usedConnections: number;
  totalConnections: number;
  usedAiCredits: number;
  totalAiCredits: number;
  maxUsers: number;
}

// Cache for storage sizes to avoid recalculating too frequently
const userStorageCache: Record<string, { size: number; timestamp: number }> =
  {};

/**
 * Store subscription details in local storage
 */
export function storeSubscriptionData(subscription: Subscription): void {
  if (typeof window === "undefined") return;

  try {
    const subscriptionData: StoredSubscriptionData = {
      id: subscription.id,
      status: subscription.status,
      planType: subscription.planType,
      organizationId: subscription.organizationId,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || "",
      lastUpdated: Date.now(),
      // Usage data
      usedStorage: subscription.usedStorage,
      totalStorage: subscription.totalStorage,
      usedConnections: subscription.usedConnections,
      totalConnections: subscription.totalConnections,
      usedAiCredits: subscription.usedAiCredits,
      totalAiCredits: subscription.totalAiCredits,
      maxUsers: subscription.maxUsers,
    };

    if (subscription.trialEndsAt) {
      subscriptionData.trialEndsAt = subscription.trialEndsAt.toISOString();
      subscriptionData.hasTrialEnded = subscription.hasTrialEnded;
    }

    localStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION_DATA,
      JSON.stringify(subscriptionData)
    );
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());

    logger.debug("Subscription data stored in local storage", subscriptionData);
  } catch (error) {
    console.error("Failed to store subscription data in local storage", error);
  }
}

/**
 * Get subscription details from local storage
 */
export function getStoredSubscriptionData(): StoredSubscriptionData | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_DATA);
    if (!data) return null;

    const parsedData = JSON.parse(data) as StoredSubscriptionData;
    return parsedData;
  } catch (error) {
    console.error(
      "Failed to retrieve subscription data from local storage",
      error
    );
    return null;
  }
}

/**
 * Check if stored subscription data is stale (older than the specified maxAge in milliseconds)
 * Default maxAge is 1 hour
 */
export function isStoredSubscriptionStale(
  maxAge: number = 60 * 60 * 1000
): boolean {
  if (typeof window === "undefined") return true;

  const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
  if (!lastUpdated) return true;

  const now = Date.now();
  const lastUpdateTime = parseInt(lastUpdated, 10);

  return now - lastUpdateTime > maxAge;
}

/**
 * Background update of subscription data
 * Returns a promise that resolves to true if update was successful
 */
export async function updateSubscriptionDataInBackground(): Promise<boolean> {
  try {
    // Only update if data is stale or doesn't exist
    if (!isStoredSubscriptionStale() && getStoredSubscriptionData()) {
      logger.debug("Skipping background update - subscription data is fresh");
      return true;
    }

    logger.debug("Updating subscription data in background");
    const response = await fetch("/api/auth/check-subscription", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to verify subscription");
    }

    const data = await response.json();

    // If we have subscription data, store it
    if (data.subscription) {
      storeSubscriptionData(data.subscription);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to update subscription data in background", error);
    return false;
  }
}

/**
 * Check if local storage indicates an active subscription
 */
export function hasStoredActiveSubscription(): boolean {
  const data = getStoredSubscriptionData();
  if (!data) return false;

  // Valid active status values from Stripe
  const activeStatuses = ["active", "trialing", "past_due", "unpaid"];

  // Check if status is active
  if (activeStatuses.includes(data.status)) {
    return true;
  }

  // Check trial period
  if (data.trialEndsAt && !data.hasTrialEnded) {
    const trialEnd = new Date(data.trialEndsAt);
    const now = new Date();
    if (trialEnd > now) {
      return true;
    }
  }

  // Check current period
  if (data.currentPeriodEnd) {
    const periodEnd = new Date(data.currentPeriodEnd);
    const now = new Date();

    // Only honor the valid period for certain statuses
    const validPeriodStatuses = [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ];

    if (
      (validPeriodStatuses.includes(data.status) || !data.status) &&
      periodEnd > now
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a subscription is currently in a trial period
 */
export function isInTrialPeriod(subscription: Subscription): boolean {
  if (!subscription.trialEndsAt) {
    return false;
  }

  if (subscription.hasTrialEnded) {
    return false;
  }

  const now = new Date();
  return subscription.trialEndsAt > now;
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysRemaining(subscription: Subscription): number {
  if (!isInTrialPeriod(subscription)) {
    return 0;
  }

  const now = new Date();
  const trialEnd = subscription.trialEndsAt!;
  const diffTime = Math.abs(trialEnd.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get trial days remaining from stored subscription data
 */
export function getStoredTrialDaysRemaining(): number {
  const data = getStoredSubscriptionData();
  if (!data || !data.trialEndsAt || data.hasTrialEnded) {
    return 0;
  }

  const now = new Date();
  const trialEnd = new Date(data.trialEndsAt);

  if (trialEnd <= now) {
    return 0;
  }

  const diffTime = Math.abs(trialEnd.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if a subscription has access to the service
 * (either active subscription or in trial period)
 */
export function hasActiveAccess(subscription: Subscription): boolean {
  if (!subscription) return false;

  logger.debug(`Checking subscription status`, {
    id: subscription.id,
    status: subscription.status,
    periodEnd: subscription.currentPeriodEnd?.toISOString(),
  });

  // Valid active status values from Stripe
  const activeStatuses = ["active", "trialing", "past_due", "unpaid"];

  // First check Stripe status
  if (activeStatuses.includes(subscription.status)) {
    logger.debug(`Subscription has active status`, {
      id: subscription.id,
      status: subscription.status,
    });
    return true;
  }

  // Special case for trial period - double check trial parameters
  if (isInTrialPeriod(subscription)) {
    logger.debug(`Subscription is in trial period`, { id: subscription.id });
    return true;
  }

  // Additional check for any subscription that has a valid current period
  // This ensures access even if webhooks failed to update status
  const now = new Date();
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd > now) {
    // Only honor the valid period for certain statuses
    // We don't want canceled subscriptions to be considered active
    const validPeriodStatuses = [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ];

    if (
      validPeriodStatuses.includes(subscription.status) ||
      !subscription.status
    ) {
      logger.debug(`Subscription has valid period`, {
        id: subscription.id,
        validUntil: subscription.currentPeriodEnd.toISOString(),
      });
      return true;
    }
  }

  logger.debug(`Subscription is not active`, {
    id: subscription.id,
    status: subscription.status,
  });
  return false;
}

/**
 * Calculate client cache size for a user - using PostgreSQL's calculation capabilities
 * Uses caching to avoid frequent recalculations
 */
export async function calculateUserCacheSize(userId: string): Promise<number> {
  if (typeof window !== "undefined") return 0;

  try {
    // Check if we have a recent cached value (within last 5 minutes)
    const cachedData = userStorageCache[userId];
    const now = Date.now();
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    if (cachedData && now - cachedData.timestamp < cacheExpiry) {
      return cachedData.size;
    }

    // Use raw PostgreSQL query to calculate total size directly in the database
    // This avoids loading all records into memory
    const result = await db.$queryRaw<[{ total_size_mb: number }]>`
      SELECT 
        CEIL(SUM(LENGTH("value")::decimal) / (1024 * 1024)) as total_size_mb
      FROM "ClientCache"
      WHERE "userId" = ${userId}
    `;

    // Get the calculated size or default to 0
    const size = result[0]?.total_size_mb || 0;

    // Store in cache
    userStorageCache[userId] = { size, timestamp: now };

    return size;
  } catch (error) {
    console.error("Error calculating user cache size:", error);

    // If we have a cached value, return it even if expired
    if (userStorageCache[userId]) {
      return userStorageCache[userId].size;
    }

    return 0;
  }
}

/**
 * Count connected accounts for a user
 */
export async function countUserConnections(userId: string): Promise<number> {
  try {
    // Count IMAP accounts
    const imapCount = await db.imapAccount.count({
      where: { userId },
    });

    // Count Twilio accounts
    const twilioCount = await db.twilioAccount.count({
      where: { userId },
    });

    // Count JustCall accounts (through SyncAccount)
    const justCallCount = await db.syncAccount.count({
      where: {
        userId,
        platform: "justcall",
      },
    });

    // Gmail is already a default connection (1) plus all other accounts
    return 1 + imapCount + twilioCount + justCallCount;
  } catch (error) {
    console.error("Error counting user connections:", error);
    return 1; // Default to at least 1 connection
  }
}

/**
 * Get subscription data for a user from the database
 * @param {string} userId - The user ID
 * @param {boolean} updateUsage - Whether to update usage data (defaults to false)
 */
export async function getUserSubscriptionData(
  userId: string,
  updateUsage = false
): Promise<StoredSubscriptionData | null> {
  try {
    // Find the user and their organization
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            subscription: true,
          },
        },
        ownedOrganizations: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) return null;

    // Find an organization this user belongs to that has a subscription
    const userOrg =
      user.organizations.find(
        (org: Organization & { subscription: Subscription | null }) =>
          org.subscription
      ) ||
      user.ownedOrganizations.find(
        (org: Organization & { subscription: Subscription | null }) =>
          org.subscription
      );

    if (!userOrg || !userOrg.subscription) return null;

    // Get the subscription
    const subscription = userOrg.subscription;

    let updatedSubscription = subscription;

    // Only calculate and update usage if explicitly requested
    if (updateUsage) {
      // Calculate current usage for this user
      const userStorageUsed = await calculateUserCacheSize(userId);
      const userConnections = await countUserConnections(userId);

      // Update the database with the latest usage
      const updated = await updateSubscriptionUsage(
        subscription.id,
        userStorageUsed,
        userConnections,
        0 // No AI credits update
      );

      if (updated) {
        updatedSubscription = updated;
      }
    }

    // Create subscription data object
    const subscriptionData: StoredSubscriptionData = {
      id: updatedSubscription.id,
      status: updatedSubscription.status,
      planType: updatedSubscription.planType,
      organizationId: updatedSubscription.organizationId,
      currentPeriodEnd:
        updatedSubscription.currentPeriodEnd?.toISOString() || "",
      lastUpdated: Date.now(),
      usedStorage: updatedSubscription.usedStorage,
      totalStorage: updatedSubscription.totalStorage,
      usedConnections: updatedSubscription.usedConnections,
      totalConnections: updatedSubscription.totalConnections,
      usedAiCredits: updatedSubscription.usedAiCredits,
      totalAiCredits: updatedSubscription.totalAiCredits,
      maxUsers: updatedSubscription.maxUsers,
    };

    if (updatedSubscription.trialEndsAt) {
      subscriptionData.trialEndsAt =
        updatedSubscription.trialEndsAt.toISOString();
      subscriptionData.hasTrialEnded = updatedSubscription.hasTrialEnded;
    }

    // Store data in local storage for future reference
    if (typeof window !== "undefined") {
      storeSubscriptionData(updatedSubscription);
    }

    return subscriptionData;
  } catch (error) {
    console.error("Error getting user subscription data:", error);
    return null;
  }
}

/**
 * Update subscription usage without overwriting other users' usage
 */
export async function updateSubscriptionUsage(
  subscriptionId: string,
  userStorageUsed: number,
  userConnections: number,
  aiCreditsUsed: number
): Promise<Subscription | null> {
  try {
    // Safety check: Ensure db is initialized
    if (!db) {
      console.error("Database connection not initialized.");
      return null;
    }

    // Safety check: Validate inputs
    if (!subscriptionId) {
      console.error(
        "updateSubscriptionUsage called with invalid subscriptionId:",
        subscriptionId
      );
      return null;
    }

    // Get current subscription data with safe error handling
    let subscription;
    try {
      subscription = await db.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          organization: {
            include: {
              members: true,
            },
          },
        },
      });
    } catch (dbError) {
      console.error("Error accessing subscription in database:", dbError);
      return null;
    }

    if (!subscription) {
      console.error(`Subscription with ID ${subscriptionId} not found.`);
      return null;
    }

    // Safety check: Ensure organization exists
    if (!subscription.organization) {
      console.error(
        `Subscription ${subscriptionId} has no linked organization.`
      );
      return null;
    }

    // Get all user IDs in this organization (safely)
    const memberIds =
      subscription.organization.members?.map((member: User) => member.id) || [];

    // Initialize with the user's storage
    let totalStorageUsed = userStorageUsed;

    // Use a direct SQL query to efficiently calculate total storage
    if (memberIds.length > 0) {
      try {
        // Calculate total size directly in the database with a single query
        const result = await db.$queryRaw<[{ total_size_mb: number }]>`
          SELECT 
            CEIL(SUM(LENGTH("value")::decimal) / (1024 * 1024)) as total_size_mb
          FROM "ClientCache"
          WHERE "userId" IN (${Prisma.join(memberIds)})
        `;

        totalStorageUsed = result[0]?.total_size_mb || totalStorageUsed;
      } catch (error) {
        console.error("Error calculating organization total storage:", error);
        // Fall back to the individual user's storage if there's an error
      }
    }

    // Cap at total allowed storage
    const newStorageUsed = Math.min(
      totalStorageUsed,
      subscription.totalStorage
    );

    // Count total connections across organization
    let totalConnectionsUsed = userConnections;

    // You could implement similar org-wide calculations for connections here

    // Update subscription with new usage data - with safe error handling
    try {
      const updatedSubscription = await db.subscription.update({
        where: { id: subscriptionId },
        data: {
          usedStorage: Math.round(newStorageUsed),
          usedConnections: Math.min(
            totalConnectionsUsed,
            subscription.totalConnections
          ),
          usedAiCredits: Math.min(
            subscription.usedAiCredits + aiCreditsUsed,
            subscription.totalAiCredits
          ),
        },
      });

      return updatedSubscription;
    } catch (updateError) {
      console.error("Error updating subscription:", updateError);
      return null;
    }
  } catch (error) {
    console.error("Error in updateSubscriptionUsage:", error);
    return null;
  }
}

/**
 * Get plan limits for a given plan type
 */
export function getPlanLimits(planType: PlanType) {
  return STRIPE_PLANS[planType]?.limits || STRIPE_PLANS.lite.limits;
}

// Format storage size for display (e.g., 1024 MB -> 1 GB)
export function formatStorage(sizeInMB: number): string {
  if (sizeInMB >= 1024) {
    return `${(sizeInMB / 1024).toFixed(1)}GB`;
  }
  return `${sizeInMB}MB`;
}

/**
 * Format subscription tier name for display
 */
export function formatTierName(planType: string): string {
  const planKey = planType as PlanType;
  if (Object.keys(STRIPE_PLANS).includes(planKey)) {
    return STRIPE_PLANS[planKey].name;
  }
  return planType.charAt(0).toUpperCase() + planType.slice(1);
}

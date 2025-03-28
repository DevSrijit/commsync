import { Subscription } from "@prisma/client";

// Structured logger for consistent format
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[SUBSCRIPTION] ${message}`, data ? data : '');
    }
  }
};

// Local storage keys
const STORAGE_KEYS = {
  SUBSCRIPTION_DATA: 'commsync_subscription_data',
  LAST_UPDATED: 'commsync_subscription_last_updated',
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
}

/**
 * Store subscription details in local storage
 */
export function storeSubscriptionData(subscription: Subscription): void {
  if (typeof window === 'undefined') return;

  try {
    const subscriptionData: StoredSubscriptionData = {
      id: subscription.id,
      status: subscription.status,
      planType: subscription.planType,
      organizationId: subscription.organizationId,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || '',
      lastUpdated: Date.now(),
    };
    
    if (subscription.trialEndsAt) {
      subscriptionData.trialEndsAt = subscription.trialEndsAt.toISOString();
      subscriptionData.hasTrialEnded = subscription.hasTrialEnded;
    }
    
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION_DATA, JSON.stringify(subscriptionData));
    localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
    
    logger.debug('Subscription data stored in local storage', subscriptionData);
  } catch (error) {
    console.error('Failed to store subscription data in local storage', error);
  }
}

/**
 * Get subscription details from local storage
 */
export function getStoredSubscriptionData(): StoredSubscriptionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_DATA);
    if (!data) return null;
    
    const parsedData = JSON.parse(data) as StoredSubscriptionData;
    return parsedData;
  } catch (error) {
    console.error('Failed to retrieve subscription data from local storage', error);
    return null;
  }
}

/**
 * Check if stored subscription data is stale (older than the specified maxAge in milliseconds)
 * Default maxAge is 1 hour
 */
export function isStoredSubscriptionStale(maxAge: number = 60 * 60 * 1000): boolean {
  if (typeof window === 'undefined') return true;

  const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
  if (!lastUpdated) return true;

  const now = Date.now();
  const lastUpdateTime = parseInt(lastUpdated, 10);
  
  return (now - lastUpdateTime) > maxAge;
}

/**
 * Background update of subscription data
 * Returns a promise that resolves to true if update was successful
 */
export async function updateSubscriptionDataInBackground(): Promise<boolean> {
  try {
    // Only update if data is stale or doesn't exist
    if (!isStoredSubscriptionStale() && getStoredSubscriptionData()) {
      logger.debug('Skipping background update - subscription data is fresh');
      return true;
    }

    logger.debug('Updating subscription data in background');
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
    console.error('Failed to update subscription data in background', error);
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
  const activeStatuses = ['active', 'trialing', 'past_due', 'unpaid'];
  
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
    const validPeriodStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired'];
    
    if ((validPeriodStatuses.includes(data.status) || !data.status) && periodEnd > now) {
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
    periodEnd: subscription.currentPeriodEnd?.toISOString()
  });
  
  // Valid active status values from Stripe
  const activeStatuses = ['active', 'trialing', 'past_due', 'unpaid'];
  
  // First check Stripe status
  if (activeStatuses.includes(subscription.status)) {
    logger.debug(`Subscription has active status`, { 
      id: subscription.id, 
      status: subscription.status 
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
    const validPeriodStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired'];
    
    if (validPeriodStatuses.includes(subscription.status) || !subscription.status) {
      logger.debug(`Subscription has valid period`, { 
        id: subscription.id, 
        validUntil: subscription.currentPeriodEnd.toISOString() 
      });
      return true;
    }
  }
  
  logger.debug(`Subscription is not active`, { 
    id: subscription.id, 
    status: subscription.status
  });
  return false;
} 
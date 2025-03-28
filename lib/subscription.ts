import { Subscription } from "@prisma/client";

// Structured logger for consistent format
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[SUBSCRIPTION] ${message}`, data ? data : '');
    }
  }
};

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
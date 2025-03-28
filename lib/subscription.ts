import { Subscription } from "@prisma/client";

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
  if (subscription.status === 'active') {
    return true;
  }
  
  if (subscription.status === 'trialing' && isInTrialPeriod(subscription)) {
    return true;
  }
  
  return false;
} 
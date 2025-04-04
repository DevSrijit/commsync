import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasActiveAccess } from '@/lib/subscription';
import { Organization, Subscription } from '@prisma/client';
// Structured logger for consistent logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[SUBSCRIPTION-CHECK] ${message}`, data ? data : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[SUBSCRIPTION-CHECK] ${message}`, error ? error : '');
  }
};

export async function GET(req: NextRequest) {
  try {
    logger.info("Starting subscription check");
    
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      logger.info("Subscription check failed: No authenticated user");
      return NextResponse.json(
        { hasActiveSubscription: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    logger.info(`Checking subscription for user: ${session.user.email}`);
    
    // Find user with organizations and subscriptions
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        organizations: {
          include: {
            subscription: true,
          },
        },
      },
    });
    
    if (!user) {
      logger.info(`User not found in database: ${session.user.email}`);
      return NextResponse.json(
        { hasActiveSubscription: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (!user.organizations || user.organizations.length === 0) {
      logger.info(`User has no organizations`, { userId: user.id });
      return NextResponse.json({
        hasActiveSubscription: false,
        organizations: []
      });
    }
    
    logger.info(`Found user with ${user.organizations.length} organizations`);
    
    // Import stripe dynamically to avoid circular dependencies
    const { stripe } = await import('@/lib/stripe');

    // Force-refresh subscription status from Stripe for organizations with subscriptions
    for (const org of user.organizations) {
      if (org.subscription?.stripeSubscriptionId) {
        try {
          const stripeSubscription = await stripe!.subscriptions.retrieve(
            org.subscription.stripeSubscriptionId
          );
          
          // Update subscription status in database to match Stripe's data
          logger.info(`Refreshing subscription from Stripe`, {
            subscriptionId: org.subscription.id,
            status: {
              before: org.subscription.status,
              after: stripeSubscription.status
            }
          });
            
          await db.subscription.update({
            where: { id: org.subscription.id },
            data: { 
              status: stripeSubscription.status,
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              // Update trial info
              trialEndsAt: stripeSubscription.trial_end 
                ? new Date(stripeSubscription.trial_end * 1000) 
                : null,
              hasTrialEnded: stripeSubscription.status === 'active' && 
                stripeSubscription.trial_end === null
            }
          });
          
          // Update the subscription object in memory with fresh data
          org.subscription.status = stripeSubscription.status;
          org.subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
          org.subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
          org.subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
          if (stripeSubscription.trial_end) {
            org.subscription.trialEndsAt = new Date(stripeSubscription.trial_end * 1000);
          }
        } catch (error) {
          logger.error(`Error refreshing subscription from Stripe`, { 
            subscriptionId: org.subscription.id, 
            error: (error as Error).message 
          });
          // Continue with local data if Stripe API fails
        }
      }
    }
    
    // Check all subscriptions after refresh
    const subscriptionDetails = user.organizations
      .filter((org: Organization & { subscription: Subscription | null }) => org.subscription)
      .map((org: Organization & { subscription: Subscription | null }) => {
        const active = org.subscription ? hasActiveAccess(org.subscription) : false;
        
        return {
          organizationId: org.id,
          subscriptionId: org.subscription?.id,
          subscriptionStatus: org.subscription?.status,
          plan: org.subscription?.planType,
          active,
          currentPeriodEnd: org.subscription?.currentPeriodEnd
        };
      });
    
    logger.info(`Subscription details`, { subscriptions: subscriptionDetails });
    
    // Check if any organization has an active subscription
    const hasActiveSubscription = user.organizations.some(
      (org: Organization & { subscription: Subscription | null }) =>
        org.subscription && hasActiveAccess(org.subscription)
    );

    logger.info(`Active subscription check result: ${hasActiveSubscription}`);
    
    return NextResponse.json({
      hasActiveSubscription,
      organizations: user.organizations.map((org: Organization & { subscription: Subscription | null }) => ({
        id: org.id,
        name: org.name,
        subscription: org.subscription 
          ? {
              status: org.subscription.status,
              plan: org.subscription.planType,
              active: hasActiveAccess(org.subscription),
              trial: org.subscription.status === 'trialing',
              trialEndsAt: org.subscription.trialEndsAt,
              currentPeriodEnd: org.subscription.currentPeriodEnd
            }
          : null
      })),
    });
  } catch (error) {
    logger.error('Error checking subscription', error);
    return NextResponse.json(
      { hasActiveSubscription: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
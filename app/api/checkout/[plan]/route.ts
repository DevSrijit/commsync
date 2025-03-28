import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, STRIPE_PLANS, type PlanType } from '@/lib/stripe';
import { db } from '@/lib/db';
import Stripe from 'stripe';

// Structured logger for consistent logging
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[CHECKOUT] ${message}`, data ? data : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[CHECKOUT] ${message}`, error ? error : '');
  }
};

// Helper function to fetch cached user data or create it
async function getOrCreateUser(email: string) {
  // First try to find the user
  let user = await db.user.findUnique({
    where: { email },
    include: { organizations: true }
  });

  // If user doesn't exist, try to create it
  if (!user) {
    try {
      user = await db.user.create({
        data: {
          email,
          name: email.split('@')[0], // Use part before @ as name
        },
        include: { organizations: true }
      });
      logger.info('Created new user', { email });
    } catch (error) {
      logger.error('Failed to create user', { email, error });
      throw error;
    }
  }

  return user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { plan: string } }
) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    
    // Log authentication status
    logger.info('Authentication status', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasEmail: !!session?.user?.email
    });
    
    // Check if user is authenticated
    if (!session?.user?.email) {
      logger.error('Authentication failed - no valid session', {
        session: session ? 'exists' : 'missing'
      });
      return NextResponse.json(
        { error: 'Authentication failed. Please sign in again.' }, 
        { status: 401 }
      );
    }

    // Ensure params.plan is properly accessed
    const planType = params.plan as PlanType;
    
    // Make sure plan exists in our config
    if (!planType || !STRIPE_PLANS[planType]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Check that we have a valid price ID for this plan
    const priceId = STRIPE_PLANS[planType].priceId;
    if (!priceId) {
      logger.error(`Price ID not found for plan`, { planType });
      return NextResponse.json(
        { error: `Price ID not configured for plan: ${planType}` }, 
        { status: 500 }
      );
    }

    // Get or create user with organization
    const user = await getOrCreateUser(session.user.email);

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      logger.info('Creating new Stripe customer', { userId: user.id, email: user.email });
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: user.name || session.user.email,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
      logger.info('Updated user with Stripe customer ID', { userId: user.id, customerId });
    }

    // Check if user already has an organization
    let organization = user.organizations.length > 0 
      ? user.organizations[0] 
      : null;
    
    // Create organization only if the user doesn't have one
    if (!organization) {
      logger.info('Creating new organization for user', { userId: user.id });
      organization = await db.organization.create({
        data: {
          name: `${user.name || session.user.email}'s Organization`,
          ownerId: user.id,
          stripeCustomerId: customerId,
          members: {
            connect: {
              id: user.id
            }
          }
        },
      });

      // Update user's organizations
      await db.user.update({
        where: { id: user.id },
        data: {
          organizations: {
            connect: {
              id: organization.id
            }
          }
        },
      });
      logger.info('Organization created and linked to user', { orgId: organization.id, userId: user.id });
    } else if (!organization.stripeCustomerId) {
      // Update the existing organization with the Stripe Customer ID if it's missing
      logger.info('Updating organization with missing Stripe customer ID', { orgId: organization.id });
      await db.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId: customerId }
      });
    }

    // Check if the organization already has an active subscription
    const existingSubscription = await db.subscription.findFirst({
      where: {
        organizationId: organization.id,
        OR: [
          { status: 'active' },
          { status: 'trialing' }
        ]
      }
    });

    if (existingSubscription) {
      logger.info('Found existing subscription', { 
        subscriptionId: existingSubscription.id,
        planType: existingSubscription.planType,
        status: existingSubscription.status
      });
      
      // If they're trying to upgrade, cancel current subscription first
      if (existingSubscription.planType !== planType) {
        try {
          logger.info('Cancelling existing subscription for upgrade', { 
            subscriptionId: existingSubscription.stripeSubscriptionId,
            fromPlan: existingSubscription.planType,
            toPlan: planType
          });
          
          // Cancel at period end to avoid immediate cancellation
          await stripe.subscriptions.update(existingSubscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
            metadata: {
              // Preserve important metadata
              organizationId: organization.id,
              userId: user.id,
              planType: existingSubscription.planType,
              cancelReason: `Upgrading to ${planType}`
            }
          });
        } catch (error) {
          logger.error('Error cancelling existing subscription', { 
            subscriptionId: existingSubscription.stripeSubscriptionId,
            error
          });
        }
      } else {
        // They're trying to subscribe to the same plan they already have
        logger.info('User attempting to subscribe to the same plan', {
          userId: user.id,
          planType
        });
        
        return NextResponse.json({ 
          url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
          message: 'You already have an active subscription to this plan.'
        });
      }
    }

    // Create checkout session parameters with enhanced metadata
    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        organizationId: organization.id,
        planType: planType,
        userId: user.id,
        email: user.email,
        organizationName: organization.name
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      client_reference_id: user.id, // Add user ID as reference
      // Set subscription data
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          planType: planType,
          userId: user.id,
          email: user.email
        },
        // Add trial period for all non-enterprise plans
        trial_period_days: (planType === 'lite' || planType === 'standard' || planType === 'business') ? 7 : undefined
      }
    };
    
    // Create Stripe Checkout session
    logger.info('Creating checkout session', { 
      planType, 
      organizationId: organization.id,
      customerId
    });
    
    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);
    
    logger.info('Checkout session created', { 
      sessionId: checkoutSession.id,
      url: checkoutSession.url ? 'provided' : 'missing'
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logger.error('Checkout error', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: (error as Error).message },
      { status: 500 }
    );
  }
} 
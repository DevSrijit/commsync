import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe, STRIPE_PLANS } from '@/lib/stripe';
import { db } from '@/lib/db';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function handleSubscriptionCreated(subscription: any) {
  const organizationId = subscription.metadata.organizationId;
  const planType = subscription.metadata.planType;

  if (!organizationId || !planType) {
    console.error('Missing metadata in subscription:', subscription.id);
    return;
  }

  const planLimits = STRIPE_PLANS[planType as keyof typeof STRIPE_PLANS]?.limits;
  if (!planLimits) {
    console.error('Invalid plan type:', planType);
    return;
  }

  // Handle trial status
  const isTrialing = subscription.status === 'trialing';
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  
  await db.subscription.create({
    data: {
      organizationId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      planType,
      maxUsers: planLimits.maxUsers,
      totalStorage: planLimits.totalStorage,
      totalConnections: planLimits.totalConnections,
      totalAiCredits: planLimits.totalAiCredits,
      usedStorage: 0,
      usedConnections: 0, 
      usedAiCredits: 0,
      // Store trial information if applicable
      trialEndsAt: trialEnd,
    },
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSubscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription) {
    console.error('Subscription not found for update:', subscription.id);
    return;
  }

  // Handle trial-related updates
  const isTrialing = subscription.status === 'trialing';
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  // Only update plan-related fields if the price has changed
  if (subscription.items.data[0].price.id !== existingSubscription.stripePriceId) {
    const planType = subscription.metadata.planType;
    const planLimits = STRIPE_PLANS[planType as keyof typeof STRIPE_PLANS]?.limits;
    
    if (planLimits) {
      await db.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          stripePriceId: subscription.items.data[0].price.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          planType,
          maxUsers: planLimits.maxUsers,
          totalStorage: planLimits.totalStorage,
          totalConnections: planLimits.totalConnections,
          totalAiCredits: planLimits.totalAiCredits,
          trialEndsAt: trialEnd,
        },
      });
      return;
    }
  }

  // If price hasn't changed, just update the standard fields
  await db.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: trialEnd,
    },
  });
}

// Handle additional trial-related events
async function handleTrialEndingSoon(subscription: any) {
  // You could send notifications to users here
  console.log(`Trial ending soon for subscription: ${subscription.id}`);
  
  // Find the organization for this subscription
  const sub = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { organization: { include: { owner: true } } },
  });
  
  if (sub) {
    // Here you would typically send an email notification
    console.log(`Trial for ${sub.organization.name} ending soon. Owner: ${sub.organization.owner.email}`);
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  await db.subscription.delete({
    where: { stripeSubscriptionId: subscription.id },
  });
}

export async function POST(req: Request) {
  try {
    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    }

    const body = await req.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
      return new NextResponse('No signature', { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'customer.subscription.trial_will_end':
        // Stripe sends this 3 days before trial end
        await handleTrialEndingSoon(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse(
      'Webhook error: ' + (error as Error).message,
      { status: 400 }
    );
  }
} 
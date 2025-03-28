import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe, STRIPE_PLANS } from "@/lib/stripe";
import { db } from "@/lib/db";

// Explicitly setting the webhook secret since the environment variable may not be working properly
const webhookSecret = "whsec_a38632c432cd056cc13d89ea126a969efcfba20f5f8c41d09fa8fb5a0463a0f7";
// Fallback to environment variable if needed
// const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_baA0PbKmcjQccNGchBQGL6JNIgQ8JJWh';

// Structured logger to prevent excessive console output
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? data : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error ? error : '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${message}`, data ? data : '');
    }
  }
};

async function handleSubscriptionCreated(subscription: any) {
  try {
    logger.info("Processing subscription creation", {
      id: subscription.id,
      status: subscription.status
    });
    
    const organizationId = subscription.metadata?.organizationId;
    const planType = subscription.metadata?.planType;
    const userId = subscription.metadata?.userId;

    if (!organizationId || !planType) {
      logger.error("Missing required metadata in subscription", {
        id: subscription.id,
        metadata: subscription.metadata
      });
      
      // Try to get the subscription directly from Stripe to ensure metadata is up-to-date
      const refreshedSubscription = await stripe.subscriptions.retrieve(subscription.id);
      
      // Check if metadata is now available in the refreshed subscription
      if (refreshedSubscription.metadata?.organizationId && refreshedSubscription.metadata?.planType) {
        logger.info("Retrieved missing metadata from Stripe", refreshedSubscription.metadata);
        return await handleSubscriptionCreated(refreshedSubscription);
      }
      
      return;
    }

    const planLimits =
      STRIPE_PLANS[planType as keyof typeof STRIPE_PLANS]?.limits;
    if (!planLimits) {
      logger.error("Invalid plan type", { planType });
      return;
    }

    // Handle trial status
    const isTrialing = subscription.status === "trialing";
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;

    logger.info("Creating/updating subscription in database", { organizationId, planType });
    
    // Check if subscription already exists to avoid duplicates
    const existingSubscription = await db.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });
    
    if (existingSubscription) {
      logger.info("Updating existing subscription", { id: subscription.id });
      await db.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          stripePriceId: subscription.items.data[0].price.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          planType,
          maxUsers: planLimits.maxUsers,
          maxStorage: planLimits.maxStorage,
          maxConnections: planLimits.maxConnections,
          totalStorage: planLimits.totalStorage,
          totalConnections: planLimits.totalConnections,
          totalAiCredits: planLimits.totalAiCredits,
          trialEndsAt: trialEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      logger.info("Subscription updated successfully", { id: subscription.id });
    } else {
      // Create new subscription
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
          maxStorage: planLimits.maxStorage,
          maxConnections: planLimits.maxConnections,
          totalStorage: planLimits.totalStorage,
          totalConnections: planLimits.totalConnections,
          totalAiCredits: planLimits.totalAiCredits,
          usedStorage: 0,
          usedConnections: 0,
          usedAiCredits: 0,
          // Store trial information if applicable
          trialEndsAt: trialEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      logger.info("New subscription created successfully", { id: subscription.id });
    }

    // If user ID was provided, ensure their email is verified
    if (userId) {
      logger.debug("Verifying email for user", { userId });
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (user && !user.emailVerified) {
        await db.user.update({
          where: { id: userId },
          data: { emailVerified: new Date() },
        });
        logger.info("User email verified", { userId });
      }
    }
    
    // Update organization with Stripe customer ID if needed
    if (subscription.customer) {
      await db.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: subscription.customer }
      });
      logger.info("Updated organization with Stripe customer ID", { 
        organizationId, 
        stripeCustomerId: subscription.customer 
      });
    }
    
    logger.info("Subscription creation/update completed");
  } catch (error) {
    logger.error("Error handling subscription", error);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const existingSubscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      organization: {
        include: {
          owner: true,
        },
      },
    },
  });

  if (!existingSubscription) {
    console.error("Subscription not found for update:", subscription.id);
    return;
  }

  // Handle trial-related updates
  const isTrialing = subscription.status === "trialing";
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  // Only update plan-related fields if the price has changed
  if (
    subscription.items.data[0].price.id !== existingSubscription.stripePriceId
  ) {
    const planType = subscription.metadata.planType;
    const planLimits =
      STRIPE_PLANS[planType as keyof typeof STRIPE_PLANS]?.limits;

    if (planLimits) {
      await db.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          stripePriceId: subscription.items.data[0].price.id,
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          planType,
          maxUsers: planLimits.maxUsers,
          maxStorage: planLimits.maxStorage,
          maxConnections: planLimits.maxConnections,
          totalStorage: planLimits.totalStorage,
          totalConnections: planLimits.totalConnections,
          totalAiCredits: planLimits.totalAiCredits,
          trialEndsAt: trialEnd,
          hasTrialEnded:
            subscription.status === "active" && isTrialing === false,
        },
      });

      // Handle email verification for the organization owner if needed
      const ownerId = existingSubscription.organization.ownerId;
      if (ownerId) {
        const owner = await db.user.findUnique({
          where: { id: ownerId },
        });

        if (owner && !owner.emailVerified) {
          await db.user.update({
            where: { id: ownerId },
            data: { emailVerified: new Date() },
          });
        }
      }

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
      hasTrialEnded: subscription.status === "active" && isTrialing === false,
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
    console.log(
      `Trial for ${sub.organization.name} ending soon. Owner: ${sub.organization.owner.email}`
    );
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
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }

    // Get the raw request body as ArrayBuffer and convert to string
    const rawBody = await req.arrayBuffer();
    const body = Buffer.from(rawBody).toString("utf8");

    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return new NextResponse("No signature", { status: 400 });
    }

    logger.debug("Processing webhook with signature", signature);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      logger.error("Webhook signature verification failed", err);
      return new NextResponse(`Webhook signature verification failed: ${(err as Error).message}`, {
        status: 400
      });
    }

    logger.info("Received webhook event", { type: event.type });
    
    // Only log full event data for specific event types or in debug mode
    if (["customer.subscription.created", "customer.subscription.updated", "checkout.session.completed"].includes(event.type)) {
      logger.debug("Event data for important event", event.data.object);
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
          await handleSubscriptionCreated(event.data.object);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object);
          break;
        case "customer.subscription.trial_will_end":
          await handleTrialEndingSoon(event.data.object);
          break;
        case "checkout.session.completed":
          const session = event.data.object;
          
          if (session.mode === 'subscription' && session.subscription) {
            const subscriptionId = session.subscription as string;
            logger.info("Processing subscription from checkout", { subscriptionId });
            
            try {
              // Extract metadata from checkout session
              const metadata = session.metadata || {};
              
              // Get subscription from Stripe
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              
              // If metadata is missing in the subscription but present in the session,
              // update the subscription with session metadata
              if (
                (!subscription.metadata?.organizationId || !subscription.metadata?.planType) && 
                (metadata.organizationId && metadata.planType)
              ) {
                logger.info("Updating subscription with metadata from checkout session", {
                  subscriptionId,
                  metadata
                });
                
                // Update the subscription with metadata
                await stripe.subscriptions.update(subscriptionId, {
                  metadata: {
                    ...subscription.metadata,
                    organizationId: metadata.organizationId,
                    planType: metadata.planType,
                    userId: metadata.userId
                  }
                });
                
                // Retrieve updated subscription
                const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                await handleSubscriptionCreated(updatedSubscription);
              } else {
                // Create or update subscription with existing metadata
                await handleSubscriptionCreated(subscription);
              }
            } catch (error) {
              logger.error("Error processing checkout session", error);
            }
          }
          break;
        case "invoice.payment_succeeded":
        case "invoice.paid":
          // Make sure subscription data is updated when payment succeeds
          const invoice = event.data.object;
          if (invoice.subscription) {
            try {
              const subscriptionId = invoice.subscription as string;
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              await handleSubscriptionCreated(subscription);
            } catch (error) {
              logger.error("Error processing invoice event", error);
            }
          }
          break;
        default:
          logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      logger.error(`Error handling webhook event type ${event.type}`, error);
      // Don't throw so we can return 200 to Stripe
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error("Webhook error", error);
    return new NextResponse("Webhook error: " + (error as Error).message, {
      status: 400,
    });
  }
}


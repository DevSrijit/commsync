import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe, STRIPE_PLANS } from "@/lib/stripe";
import { db } from "@/lib/db";
import sgMail from "@sendgrid/mail";

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Fallback to environment variable if needed
const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_baA0PbKmcjQccNGchBQGL6JNIgQ8JJWh";

// Structured logger to prevent excessive console output
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? data : "");
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error ? error : "");
  },
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] ${message}`, data ? data : "");
    }
  },
};

async function handleSubscriptionCreated(subscription: any) {
  try {
    logger.info("Processing subscription creation", {
      id: subscription.id,
      status: subscription.status,
    });

    const organizationId = subscription.metadata?.organizationId;
    const planType = subscription.metadata?.planType;
    const userId = subscription.metadata?.userId;

    if (!organizationId || !planType) {
      logger.error("Missing required metadata in subscription", {
        id: subscription.id,
        metadata: subscription.metadata,
      });

      // Try to get the subscription directly from Stripe to ensure metadata is up-to-date
      const refreshedSubscription = await stripe!.subscriptions.retrieve(
        subscription.id
      );

      // Check if metadata is now available in the refreshed subscription
      if (
        refreshedSubscription.metadata?.organizationId &&
        refreshedSubscription.metadata?.planType
      ) {
        logger.info(
          "Retrieved missing metadata from Stripe",
          refreshedSubscription.metadata
        );
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

    logger.info("Creating/updating subscription in database", {
      organizationId,
      planType,
    });

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
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
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
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
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
      logger.info("New subscription created successfully", {
        id: subscription.id,
      });
    }

    // If user ID was provided, ensure their email is verified
    if (userId) {
      logger.debug("Verifying email for user", { userId });
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        // Mark user as onboarded and verify email if needed
        await db.user.update({
          where: { id: userId },
          data: {
            isOnboarded: true,
            emailVerified: user.emailVerified || new Date(),
          },
        });
        logger.info("User marked as onboarded", { userId });
      }
    }

    // Find organization's owner and mark them as onboarded too
    try {
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        include: { owner: true },
      });

      if (organization && organization.owner) {
        await db.user.update({
          where: { id: organization.owner.id },
          data: { isOnboarded: true },
        });
        logger.info("Organization owner marked as onboarded", {
          ownerId: organization.owner.id,
        });
      }
    } catch (error) {
      logger.error("Error marking organization owner as onboarded", error);
    }

    // Update organization with Stripe customer ID if needed
    if (subscription.customer) {
      await db.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: subscription.customer },
      });
      logger.info("Updated organization with Stripe customer ID", {
        organizationId,
        stripeCustomerId: subscription.customer,
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

// New function to handle enterprise checkout completions
async function handleEnterpriseCheckoutCompleted(session: any) {
  try {
    logger.info("Processing enterprise checkout completion", {
      sessionId: session.id,
    });

    const metadata = session.metadata || {};
    const subscriptionId = session.subscription as string;

    if (!subscriptionId) {
      logger.error("No subscription ID in checkout session", {
        sessionId: session.id,
      });
      return;
    }

    // Check if this is an enterprise plan
    if (metadata.planType !== "enterprise") {
      logger.debug("Not an enterprise checkout", {
        planType: metadata.planType,
      });
      return;
    }

    // Find pending subscription in database
    const pendingSub = await db.subscription.findFirst({
      where: {
        organizationId: metadata.organizationId,
        status: "incomplete",
        customLimits: {
          path: ["checkoutSessionId"],
          equals: session.id,
        },
      },
      include: {
        organization: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!pendingSub) {
      logger.error("No pending subscription found for enterprise checkout", {
        sessionId: session.id,
        organizationId: metadata.organizationId,
      });
      return;
    }

    // Get the subscription from Stripe
    const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

    // Update the subscription with enterprise-specific metadata
    await stripe!.subscriptions.update(subscriptionId, {
      metadata: {
        ...subscription.metadata,
        organizationId: metadata.organizationId,
        planType: "enterprise",
        maxUsers: metadata.maxUsers,
        maxStorage: metadata.maxStorage,
        maxConnections: metadata.maxConnections,
        aiCredits: metadata.aiCredits,
      },
    });

    // Update subscription in the database
    await db.subscription.update({
      where: { id: pendingSub.id },
      data: {
        stripeSubscriptionId: subscriptionId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        maxUsers: parseInt(metadata.maxUsers),
        maxStorage: parseInt(metadata.maxStorage),
        maxConnections: parseInt(metadata.maxConnections),
        totalStorage: parseInt(metadata.maxStorage),
        totalConnections: parseInt(metadata.maxConnections),
        totalAiCredits: parseInt(metadata.aiCredits),
        customLimits: {
          ...pendingSub.customLimits,
          status: "active",
          checkoutCompletedAt: new Date().toISOString(),
        },
      },
    });

    // Send confirmation emails
    const owner = pendingSub.organization.owner;
    if (owner && owner.email) {
      // Email to customer
      await sgMail.send({
        to: owner.email,
        from: "commsync@havenmediasolutions.com",
        subject: "Your CommSync Enterprise Subscription is Active",
        html: `
          <h2>Welcome to CommSync Enterprise!</h2>
          <p>Dear ${owner.name || "Valued Customer"},</p>
          <p>Your enterprise subscription is now active. Thank you for choosing CommSync!</p>
          
          <h3>Your Plan Details</h3>
          <ul>
            <li><strong>Team Size:</strong> ${metadata.maxUsers} users</li>
            <li><strong>Storage:</strong> ${metadata.maxStorage}MB</li>
            <li><strong>Connected Accounts:</strong> ${
              metadata.maxConnections
            }</li>
            <li><strong>AI Credits:</strong> ${
              metadata.aiCredits
            } per month</li>
          </ul>
          
          <p>You can now access all enterprise features by logging into your dashboard:</p>
          <p><a href="${
            process.env.NEXT_PUBLIC_APP_URL
          }/dashboard" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a></p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Thank you again for your business!</p>
        `,
      });

      // Email to admin team
      await sgMail.send({
        to: "commsync@havenmediasolutions.com",
        from: "commsync@havenmediasolutions.com",
        subject: "Enterprise Subscription Activated",
        html: `
          <h2>Enterprise Subscription Payment Successful</h2>
          <p><strong>Customer:</strong> ${owner.email} (${
          owner.name || "No name"
        })</p>
          <p><strong>Subscription ID:</strong> ${subscriptionId}</p>
          <p><strong>Plan Details:</strong></p>
          <ul>
            <li><strong>Team Size:</strong> ${metadata.maxUsers} users</li>
            <li><strong>Storage:</strong> ${metadata.maxStorage}MB</li>
            <li><strong>Connected Accounts:</strong> ${
              metadata.maxConnections
            }</li>
            <li><strong>AI Credits:</strong> ${
              metadata.aiCredits
            } per month</li>
          </ul>
          <p><strong>Activated At:</strong> ${new Date().toISOString()}</p>
        `,
      });
    }

    logger.info("Enterprise subscription activated successfully", {
      subscriptionId,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error("Error handling enterprise checkout", error);
  }
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
      event = stripe!.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logger.error("Webhook signature verification failed", err);
      return new NextResponse(
        `Webhook signature verification failed: ${(err as Error).message}`,
        {
          status: 400,
        }
      );
    }

    logger.info("Received webhook event", { type: event.type });

    // Only log full event data for specific event types or in debug mode
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "checkout.session.completed",
      ].includes(event.type)
    ) {
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

          if (session.mode === "subscription" && session.subscription) {
            const subscriptionId = session.subscription as string;
            logger.info("Processing subscription from checkout", {
              subscriptionId,
            });

            try {
              // Extract metadata from checkout session
              const metadata = session.metadata || {};

              // Handle enterprise checkouts
              if (metadata.planType === "enterprise") {
                await handleEnterpriseCheckoutCompleted(session);
              } else {
                // Standard plan checkout
                // Get subscription from Stripe
                const subscription = await stripe!.subscriptions.retrieve(
                  subscriptionId
                );

                // If metadata is missing in the subscription but present in the session,
                // update the subscription with session metadata
                if (
                  (!subscription.metadata?.organizationId ||
                    !subscription.metadata?.planType) &&
                  metadata.organizationId &&
                  metadata.planType
                ) {
                  logger.info(
                    "Updating subscription with metadata from checkout session",
                    {
                      subscriptionId,
                      metadata,
                    }
                  );

                  // Update the subscription with metadata
                  await stripe!.subscriptions.update(subscriptionId, {
                    metadata: {
                      ...subscription.metadata,
                      organizationId: metadata.organizationId,
                      planType: metadata.planType,
                      userId: metadata.userId,
                    },
                  });

                  // Retrieve updated subscription
                  const updatedSubscription =
                    await stripe!.subscriptions.retrieve(subscriptionId);
                  await handleSubscriptionCreated(updatedSubscription);
                } else {
                  // Create or update subscription with existing metadata
                  await handleSubscriptionCreated(subscription);
                }
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
              const subscription = await stripe!.subscriptions.retrieve(
                subscriptionId
              );
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

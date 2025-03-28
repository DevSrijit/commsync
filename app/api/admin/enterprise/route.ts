import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

const API_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !API_KEY || authHeader !== `Bearer ${API_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await req.json();
    const {
      email,
      priceId,
      maxUsers,
      maxStorage,
      maxConnections,
      aiCredits,
      customLimits,
    } = data;

    // Find or create user
    const user = await db.user.findUnique({
      where: { email },
      include: {
        organizations: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // Find existing enterprise organization or create new one
    let organization = user.organizations.find(
      org => org.subscription?.planType === 'enterprise'
    );

    if (!organization) {
      organization = await db.organization.create({
        data: {
          name: `${user.email}'s Enterprise Organization`,
          ownerId: user.id,
        },
      });

      // Add organization to user's organizations
      await db.user.update({
        where: { id: user.id },
        data: {
          organizationIds: {
            push: organization.id,
          },
        },
      });
    }

    // Create or update Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        organizationId: organization.id,
        planType: 'enterprise',
      },
    });

    // Create or update subscription in database
    await db.subscription.upsert({
      where: {
        organizationId: organization.id,
      },
      create: {
        organizationId: organization.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        planType: 'enterprise',
        maxUsers,
        maxStorage,
        maxConnections,
        aiCredits,
        customLimits,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        maxUsers,
        maxStorage,
        maxConnections,
        aiCredits,
        customLimits,
      },
    });

    return NextResponse.json({
      message: 'Enterprise subscription created successfully',
      subscriptionId: subscription.id,
      organizationId: organization.id,
    });
  } catch (error) {
    console.error('Enterprise subscription error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
} 
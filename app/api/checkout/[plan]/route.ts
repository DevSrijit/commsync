import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, STRIPE_PLANS, type PlanType } from '@/lib/stripe';
import { db } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(
  req: NextRequest,
  { params }: { params: { plan: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('params', params);
    // Ensure params.plan is properly accessed
    const planType = params.plan as PlanType;
    
    // Make sure plan exists in our config
    if (!planType || !STRIPE_PLANS[planType]) {
      return new NextResponse('Invalid plan', { status: 400 });
    }

    // Check that we have a valid price ID for this plan
    const priceId = STRIPE_PLANS[planType].priceId;
    if (!priceId) {
      console.error(`Price ID not found for plan: ${planType}`);
      return new NextResponse(`Price ID not configured for plan: ${planType}`, { status: 500 });
    }

    // Log to debug
    console.log(`Creating checkout for plan: ${planType} with price ID: ${priceId}`);

    // Get or create Stripe customer
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    });

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
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

    // Create organization for the subscription
    const organization = await db.organization.create({
      data: {
        name: `${session.user.email}'s Organization`,
        ownerId: user.id,
        stripeCustomerId: customerId,
      },
    });

    // Update user's organizations
    await db.user.update({
      where: { id: user.id },
      data: {
        organizationIds: {
          push: organization.id,
        },
      },
    });

    // Create checkout session parameters
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
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    };

    // Add trial period for standard plan
    if (planType === 'standard') {
      checkoutParams.subscription_data = {
        trial_period_days: 7,
      };
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
} 
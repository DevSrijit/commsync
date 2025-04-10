import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { Subscription } from "@prisma/client";
import { Organization } from "@prisma/client";
import sgMail from "@sendgrid/mail";

const API_KEY = process.env.ADMIN_API_KEY;

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !API_KEY || authHeader !== `Bearer ${API_KEY}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const {
      email,
      pricePerMonth, // New field: monthly price amount
      currency = "usd", // Default currency
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
      return new NextResponse("User not found", { status: 404 });
    }

    // Find existing enterprise organization or create new one
    let organization = user.organizations.find(
      (org: Organization & { subscription: Subscription | null }) =>
        org.subscription?.planType === "enterprise"
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
          organizations: {
            connect: {
              id: organization.id,
            },
          },
        },
      });
    }

    // Create or update Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe!.customers.create({
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

    // First, create a custom price for this enterprise customer
    const price = await stripe!.prices.create({
      unit_amount: pricePerMonth * 100, // Convert to cents
      currency: currency,
      recurring: { interval: "month" },
      product_data: {
        name: "CommSync Enterprise Plan",
        metadata: {
          type: "enterprise",
          userEmail: user.email,
          userName: user.name,
        },
      },
      metadata: {
        organizationId: organization.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      },
    });

    // Create Stripe checkout session
    const checkoutSession = await stripe!.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        organizationId: organization.id,
        planType: "enterprise",
        maxUsers,
        maxStorage,
        maxConnections,
        aiCredits,
        customLimits: JSON.stringify(customLimits || {}),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          planType: "enterprise",
          maxUsers,
          maxStorage,
          maxConnections,
          aiCredits,
        },
      },
    });

    // Create/update a placeholder subscription in the database with pending status
    await db.subscription.upsert({
      where: {
        organizationId: organization.id,
      },
      create: {
        organizationId: organization.id,
        stripeSubscriptionId: "pending_checkout",
        stripePriceId: price.id,
        status: "incomplete",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planType: "enterprise",
        maxUsers,
        maxStorage,
        maxConnections,
        totalStorage: maxStorage,
        totalConnections: maxConnections,
        totalAiCredits: aiCredits,
        customLimits: {
          ...customLimits,
          pricePerMonth,
          currency,
          checkoutSessionId: checkoutSession.id,
          checkoutUrl: checkoutSession.url,
          status: "pending_payment",
          createdAt: new Date().toISOString(),
        },
      },
      update: {
        stripePriceId: price.id,
        status: "incomplete",
        maxUsers,
        maxStorage,
        maxConnections,
        totalStorage: maxStorage,
        totalConnections: maxConnections,
        totalAiCredits: aiCredits,
        customLimits: {
          ...customLimits,
          pricePerMonth,
          currency,
          checkoutSessionId: checkoutSession.id,
          checkoutUrl: checkoutSession.url,
          status: "pending_payment",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    // Send email to the customer with checkout link
    await sgMail.send({
      to: user.email!,
      from: "commsync@havenmediasolutions.com",
      subject: "Your CommSync Enterprise Subscription",
      html: `
        <h2>Your CommSync Enterprise Plan is Ready</h2>
        <p>Dear ${user.name || "Valued Customer"},</p>
        <p>We've created a custom enterprise plan for you based on your requirements.</p>
        
        <h3>Plan Details</h3>
        <ul>
          <li><strong>Price:</strong> ${pricePerMonth} ${currency.toUpperCase()} per month</li>
          <li><strong>Team Size:</strong> ${maxUsers} users</li>
          <li><strong>Storage:</strong> ${maxStorage}MB</li>
          <li><strong>Connected Accounts:</strong> ${maxConnections}</li>
          <li><strong>AI Credits:</strong> ${aiCredits} per month</li>
        </ul>
        
        <p>Please click the link below to complete your subscription:</p>
        <p><a href="${
          checkoutSession.url
        }" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Complete Your Subscription</a></p>
        
        <p>If you have any questions, please contact our support team.</p>
        
        <p>Thank you for choosing CommSync!</p>
      `,
    });

    // Send notification to admin team
    await sgMail.send({
      to: "commsync@havenmediasolutions.com",
      from: "commsync@havenmediasolutions.com",
      subject: "New Enterprise Checkout Created",
      html: `
        <h2>Enterprise Checkout Link Created</h2>
        <p><strong>Customer:</strong> ${user.email} (${
        user.name || "No name"
      })</p>
        <p><strong>Price:</strong> ${pricePerMonth} ${currency.toUpperCase()} per month</p>
        <p><strong>Team Size:</strong> ${maxUsers} users</p>
        <p><strong>Storage:</strong> ${maxStorage}MB</p>
        <p><strong>Connected Accounts:</strong> ${maxConnections}</p>
        <p><strong>AI Credits:</strong> ${aiCredits} per month</p>
        <p><strong>Checkout URL:</strong> <a href="${checkoutSession.url}">${
        checkoutSession.url
      }</a></p>
        <p><strong>Session ID:</strong> ${checkoutSession.id}</p>
        <p><strong>Created At:</strong> ${new Date().toISOString()}</p>
      `,
    });

    return NextResponse.json({
      message: "Enterprise checkout link created successfully",
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
      organizationId: organization.id,
    });
  } catch (error) {
    console.error("Enterprise subscription error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

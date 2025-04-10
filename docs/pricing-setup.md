# CommSync Subscription System Setup Guide

## Overview

The CommSync subscription system is built on Stripe for payment processing and integrates with the application's database to manage user access and plan limits. This guide covers how to set up and configure the subscription system.

## Prerequisites

1. Stripe account
2. SendGrid account (for enterprise plan inquiries)
3. MongoDB database
4. Next.js application set up

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_LITE_PRICE_ID=price_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...

# SendGrid
SENDGRID_API_KEY=SG...

# Admin API (for creating enterprise subscriptions)
ADMIN_API_KEY=your_secure_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Stripe Setup

### 1. Create Products and Prices

Create the following products and prices in your Stripe dashboard:

**Lite Plan:**

```bash
stripe products create --name "Lite"
stripe prices create --product=prod_... --unit-amount=600 --currency=usd --recurring[interval]=month
```

**Standard Plan:**

```bash
stripe products create --name "Standard"
stripe prices create --product=prod_... --unit-amount=1500 --currency=usd --recurring[interval]=month
```

**Business Plan:**

```bash
stripe products create --name "Business"
stripe prices create --product=prod_... --unit-amount=2500 --currency=usd --recurring[interval]=month
```

### 2. Set Up Webhook

Set up a webhook in your Stripe dashboard to receive events:

1. Go to Developers > Webhooks in the Stripe dashboard
2. Add a new endpoint with URL: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

For local development, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Subscription Flow

1. User logs in via Google OAuth
2. Auth system checks if user has an active subscription
3. If no subscription, user is redirected to the pricing page
4. User selects a plan and proceeds to Stripe checkout
5. After successful payment, user is redirected to the dashboard
6. Webhook handler updates the subscription status in the database

## Enterprise Subscription Management

### Enterprise Inquiry Flow

1. User fills out an enterprise inquiry form from the pricing page
2. Form data is sent to the `/api/contact/enterprise` endpoint
3. The system sends an email via SendGrid with the inquiry details
4. If the user is logged in, it creates an organization with a pending enterprise subscription

### Creating Enterprise Subscriptions

Use the admin API endpoint to create a checkout link for enterprise customers:

```bash
curl -X POST https://your-domain.com/api/admin/enterprise \
  -H "Authorization: Bearer your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "pricePerMonth": 499, # Price in dollars (499 = $499.00 per month)
    "currency": "usd",
    "maxUsers": 50,
    "maxStorage": 5000,
    "maxConnections": 100, 
    "aiCredits": 1000,
    "customLimits": {
      "additionalFeature": true
    }
  }'
```

The API will:

1. Create a custom price in Stripe with the specified amount
2. Generate a checkout link for the customer
3. Send an email to the customer with the checkout link
4. Send a notification to the admin team
5. Return the checkout URL in the response:

```json
{
  "message": "Enterprise checkout link created successfully",
  "checkoutUrl": "https://checkout.stripe.com/...",
  "checkoutSessionId": "cs_test_...",
  "organizationId": "org_..."
}
```

### Enterprise Checkout Flow

1. Customer receives email with checkout link
2. Customer completes payment through Stripe checkout
3. Stripe webhook notifies the application of successful payment
4. System updates subscription status to active
5. Confirmation emails are sent to both customer and admin team
6. Customer can now access their enterprise features

This workflow allows for a seamless self-service experience while maintaining control over enterprise pricing and limits.

### Required Parameters

- **email**: Customer's email address (must exist in the system)
- **pricePerMonth**: Monthly price in whole currency units (e.g., 499 for $499.00)
- **currency**: Currency code (default: "usd")
- **maxUsers**: Maximum number of users allowed
- **maxStorage**: Maximum storage in MB
- **maxConnections**: Maximum number of connected accounts
- **aiCredits**: Monthly AI credits allocation
- **customLimits**: Optional JSON object for additional custom settings

### Authentication

The Admin API requires the `ADMIN_API_KEY` for authentication, which should be set in your environment variables.

## Billing Process

1. **Initial Setup**:
   - Admin creates a checkout link via the API
   - Customer receives email with checkout link
   - Customer completes payment through Stripe checkout

2. **Recurring Billing**:
   - Stripe automatically bills the customer according to the subscription terms
   - No additional manual steps required for recurring billing

3. **Subscription Updates**:
   - To change pricing or limits, use the admin API again to create a new checkout link
   - Customer will need to complete the new checkout process

## Testing

### Testing Subscriptions

1. Use Stripe test cards:
   - `4242 4242 4242 4242` - Successful payment
   - `4000 0000 0000 9995` - Insufficient funds
   - `4000 0002 4000 0000` - Requires authentication

2. Test webhook events using the Stripe CLI:

   ```bash
   stripe trigger customer.subscription.created
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

## Plan Limits

The system enforces the following limits based on subscription plans:

- **Lite**: 1 user, 6 connected accounts, 100MB storage, 25 AI credits
- **Standard**: 3 users, 10 connected accounts per user, 500MB storage per user, 100 AI credits per user
- **Business**: 8 users, 20 connected accounts per user, 1GB storage per user, 200 AI credits per user
- **Enterprise**: Custom limits set via admin API

## Database Schema

The subscription system uses the following database models:

1. **User**: Contains user information and links to organizations
2. **Organization**: Represents a team with subscription
3. **Subscription**: Contains plan information and usage limits

## Common Issues and Troubleshooting

### Webhook Errors

- Check if the webhook signing secret is correctly set in environment variables
- Verify that your webhook URL is accessible from the internet
- Check Stripe dashboard for failed webhook attempts

### Subscription Issues

- Check if all required price IDs are correctly set in environment variables
- Verify that the customer ID in Stripe matches the one in your database
- Check webhook logs for subscription events

### Enterprise Plan Issues

- Verify that the admin API key is set and secure
- Check that the user exists in the database before creating an enterprise subscription
- Verify that the price ID exists in Stripe

## Security Considerations

1. Keep your Stripe secret key and webhook signing secret secure
2. Implement rate limiting for the enterprise inquiry form
3. Use proper authentication for the admin API
4. Validate all inputs on both client and server
5. Store subscription data securely in your database

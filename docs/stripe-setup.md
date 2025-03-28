# Stripe Setup Guide for CommSync

## Overview

This guide will help you properly set up Stripe products and prices for the CommSync subscription system.

## Creating Products and Prices in Stripe

Each subscription plan in CommSync (Lite, Standard, Business) needs both a Product and a Price in Stripe.

### Step 1: Creating Products

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Products** > **Add Product**
3. Create the following products:

**Lite Product:**
- Name: "Lite"
- Description: "1 user, 6 connected accounts, 100MB storage, 25 AI credits"

**Standard Product:**
- Name: "Standard"
- Description: "Up to 3 users, 10 connected accounts per user, 500MB storage per user, 100 AI credits per user"

**Business Product:**
- Name: "Business"
- Description: "Up to 8 users, 20 connected accounts per user, 1GB storage per user, 200 AI credits per user"

### Step 2: Creating Prices

For each product, create a price by:
1. Clicking on the product
2. Scrolling down to **Pricing** > **Add pricing plan**
3. Configure each price as follows:

**Lite Price:**
- Pricing model: Standard pricing
- Recurring price: $6.00 / month
- Billing period: Monthly

**Standard Price:**
- Pricing model: Standard pricing
- Recurring price: $15.00 / month
- Billing period: Monthly

**Business Price:**
- Pricing model: Standard pricing
- Recurring price: $25.00 / month
- Billing period: Monthly

### Step 3: Getting Price IDs

After creating the prices, you need to get their IDs for your environment variables:

1. Go to each product in your Stripe Dashboard
2. Click on the price to view its details
3. Look for the **Price ID** which starts with `price_`
4. Copy these IDs to your `.env` file:

```
STRIPE_LITE_PRICE_ID=price_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

## Common Issues

### Using Product IDs instead of Price IDs

The most common mistake is using a Product ID (starting with `prod_`) instead of a Price ID (starting with `price_`).

Stripe's checkout requires a Price ID because:
- A Product represents what you're selling
- A Price represents how much it costs and the billing cycle

### Price ID Not Found

If you see an error like `No such price: 'prod_...'`, it means you're using a Product ID where Stripe expects a Price ID.

### Testing Stripe Integration

To test your integration:
1. Use test cards like `4242 4242 4242 4242`
2. Monitor Stripe webhook events in the dashboard
3. Use Stripe CLI to test locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## CLI Commands for Creating Products and Prices

Alternatively, you can use the Stripe CLI to create products and prices:

```bash
# Create Lite product and price
stripe products create --name "Lite" --description "1 user, 6 connected accounts, 100MB storage, 25 AI credits"
stripe prices create --product=[PRODUCT_ID] --unit-amount=600 --currency=usd --recurring[interval]=month

# Create Standard product and price
stripe products create --name "Standard" --description "Up to 3 users, 10 connected accounts per user, 500MB storage per user, 100 AI credits per user"
stripe prices create --product=[PRODUCT_ID] --unit-amount=1500 --currency=usd --recurring[interval]=month

# Create Business product and price
stripe products create --name "Business" --description "Up to 8 users, 20 connected accounts per user, 1GB storage per user, 200 AI credits per user"
stripe prices create --product=[PRODUCT_ID] --unit-amount=2500 --currency=usd --recurring[interval]=month
```

Replace `[PRODUCT_ID]` with the actual Product ID returned from the first command. 
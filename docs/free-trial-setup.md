# Free Trial System for CommSync

## Overview

CommSync offers a 7-day free trial for the Standard plan. This document explains how the trial system is implemented and how it works.

## How the Trial Works

1. **Trial Period**: When a user signs up for the Standard plan, they get a 7-day free trial before they are charged.
2. **Access During Trial**: During the trial period, users have full access to all features of the Standard plan:
   - Up to 3 users
   - 30 connected accounts total
   - 1GB total storage
   - 300 AI credits monthly
   - Priority support
   - Team collaboration

3. **Trial End**: At the end of the 7-day trial, the user's payment method will be automatically charged unless they cancel before the trial ends.

## Technical Implementation

### Database Schema

The trial functionality is managed through the `Subscription` model with the following fields:

```prisma
model Subscription {
  // ... other fields
  status          String // Can be 'trialing', 'active', 'canceled', etc.
  trialEndsAt     DateTime? // When the trial period ends
  trialStartedAt  DateTime? @default(now()) // When the trial started
  hasTrialEnded   Boolean   @default(false) // Flag to track if trial has ended
}
```

### Checkout Process

When a user selects the Standard plan, the checkout process includes:

1. Creating a Stripe Checkout session with `trial_period_days: 7`
2. After successful checkout, Stripe creates a subscription in the `trialing` status
3. The webhook handler catches this event and updates our database accordingly

```typescript
// Code snippet from checkout endpoint
if (planType === 'standard') {
  checkoutParams.subscription_data = {
    trial_period_days: 7,
  };
}
```

### Webhook Handling

The system handles the following events related to trials:

1. `customer.subscription.created` - Initial creation of subscription with trial
2. `customer.subscription.updated` - Status changes from 'trialing' to 'active'
3. `customer.subscription.trial_will_end` - Sent 3 days before trial ends

### Helper Functions

The system includes helper functions to:

- Check if a subscription is currently in trial period
- Calculate days remaining in a trial
- Determine if a subscription has active access (either paid or in trial)

## User Experience

### Trial Indication

The trial is clearly indicated to users through:

1. **Pricing Page**: The Standard plan displays a "7-Day Trial" badge
2. **Dashboard**: Users see a trial countdown showing days remaining
3. **Email Notifications**: Users receive reminders 3 days before the trial ends

### Trial Expiration

When a trial expires:

1. If the user has a valid payment method, they are automatically moved to a paid subscription
2. If payment fails, they receive a notification and are prompted to update payment information
3. If they do not update payment, their access will be limited to the free features

## Testing the Trial

To test the trial system:

1. Use a test card (e.g., `4242 4242 4242 4242`) to sign up for the Standard plan
2. The subscription will be created in `trialing` status
3. After 7 days, it will automatically convert to a paid subscription

To simulate trial events for testing, use the Stripe CLI:

```bash
stripe trigger customer.subscription.trial_will_end
```

## Cancellation Process

Users can cancel their trial at any time before it ends:

1. Navigate to the Billing section in their account
2. Click "Cancel Subscription"
3. Confirm cancellation

When a trial is canceled, the subscription status is updated to `canceled` and access continues until the trial end date. 
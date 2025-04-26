# Phase 3 Progress Report Document

## Current Status of the Project

- GMail still works but it's only restricted to about ~100 people signing up because we're on `external` mode but Google cannot verify out project.
- In Phase 4, we have to get rid of google mail as a connector. We'll only use google for signing in.
- Currently, BulkVS sits implemented but untested - Pretty sure it would sure.
- DB issues have been completely resolved. Connections are always stable & we don't face weird black outs.
- Auth, Subscriptions, Enterprise plan, all of these are build and detailed in the upcoming sections.

## Authentication

Currently, we use google to sign in. In phase 4, we will suport email & password as well.
Every user has their own organization created upon subscriping to a plan. They get an unique access
code that they can share with other users to invite them to their organization. **This is an unique feature
which was primarily developed in phase 3**.

## Subscriptions

Subscriptions use stripe & are laid out based on the plans we established. Enterprise plan works differently
and is detailed below. People can avoid creating a new subscription by using an access code to an existing
paid organization.

## Enterprise plan

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

### API Authentication

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

## Project Setup & Codebase Debrief

### 1. Project Overview

CommSync is a comprehensive business communication platform that integrates multiple communication channels (email, SMS, IMAP) into a unified interface. The project is built using Next.js with TypeScript and follows a modern, component-based architecture.

### 2. Core Architecture

#### 2.1 Directory Structure

```text
/app           # Next.js app directory with pages and layouts
  /api         # API routes
  /(legal)     # Legal pages (ToS, Privacy)
  /pricing     # Pricing pages
  /dashboard   # Main dashboard
  /login       # Authentication
  /auth        # Auth-related pages

/lib           # Core logic and services
  sync-service.ts      # Email synchronization service
  email-store.ts       # State management for emails
  messaging.ts         # Messaging functionality
  types.ts            # TypeScript type definitions
  bulkvs-service.ts   # BulkVS SMS integration
  gmail-api.ts        # Gmail API integration
  auth.ts             # Authentication logic
  twilio-service.ts   # Twilio SMS integration
  justcall-service.ts # JustCall integration
  subscription.ts     # Subscription management
  db.ts              # Database operations

/components     # React components
  /ui           # Reusable UI components
  /hero         # Landing page components
  /blocks       # Layout blocks
  /providers    # Context providers
  /ai           # AI-related components
  /magicui      # UI components
  /Threads      # Thread-related components

/scripts        # Utility scripts
  create-superuser.ts
  check-mongodb-dependencies.ts
  migrate-data.ts
```

### 3. Core Services

#### 3.1 Communication Services

1. **Email Services**
   - `sync-service.ts`: Manages email synchronization across different providers
   - `gmail-api.ts`: Handles Gmail API integration
   - `imap-service.ts`: Manages IMAP email connections
   - `email-store.ts`: State management for emails using Zustand

2. **SMS Services**
   - `twilio-service.ts`: Twilio SMS integration
   - `justcall-service.ts`: JustCall integration
   - `bulkvs-service.ts`: BulkVS SMS integration
   - `messaging.ts`: Unified messaging functionality

#### 3.2 Authentication & Authorization

- `auth.ts`: Core authentication logic
- `auth-options.ts`: Authentication configuration
- `auth-utils.ts`: Authentication utilities
- NextAuth integration for Google authentication

#### 3.3 Subscription Management

- `subscription.ts`: Handles subscription plans and limits
- `stripe.ts`: Stripe payment integration
- `ai-credits.ts`: AI credits management
- Enterprise plan support with custom pricing

### 4. Key Components

#### 4.1 Core UI Components

1. **Layout Components**
   - `sidebar.tsx`: Main navigation sidebar
   - `message-composer.tsx`: Message composition interface
   - `conversation-view.tsx`: Conversation display
   - `message-input.tsx`: Message input component

2. **Account Management**
   - `organization-dialog.tsx`: Organization management
   - `imap-account-dialog.tsx`: IMAP account setup
   - `twilio-account-dialog.tsx`: Twilio account setup
   - `justcall-account-dialog.tsx`: JustCall account setup
   - `bulkvs-account-dialog.tsx`: BulkVS account setup

3. **UI Components**
   - `ui/`: Reusable UI components using Radix UI

### 5. Data Flow

#### 5.1 Email Flow

1. User connects email accounts (Gmail/IMAP)
2. `sync-service.ts` handles synchronization
3. Emails are stored in `email-store.ts`
4. UI components display emails through `conversation-view.tsx`

#### 5.2 SMS Flow

1. User connects SMS providers (Twilio/JustCall/BulkVS)
2. Messages are processed through respective services
3. Unified messaging interface in `messaging.ts`
4. Displayed in conversation view

#### 5.3 Authentication Flow

1. User signs in with Google
2. `auth.ts` handles authentication
3. User gets assigned to an organization
4. Organization access is managed through `organization-dialog.tsx`

### 6. State Management

- Uses Zustand for state management
- `email-store.ts` for email state
- `client-cache.ts` for client-side caching
- `client-cache-browser.ts` for browser-specific caching

### 7. Database & Storage

- Prisma ORM for database operations
- PostgreSQL as the primary database
- MongoDB for certain features
- Redis/Upstash for caching

### 8. Security Features

- Encrypted credentials storage
- Secure authentication flow
- API key management
- Webhook security validation

### 9. Integration Points

1. **Email Providers**
   - Gmail API
   - IMAP servers

2. **SMS Providers**
   - Twilio
   - JustCall
   - BulkVS

3. **Payment Processing**
   - Stripe integration
   - Subscription management

4. **AI Services**
   - OpenAI integration
   - AI credits system

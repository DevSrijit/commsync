# CommSync Authentication System

This document provides an overview of the authentication system in CommSync, describing how it's implemented, configured, and how to use it.

## Overview

CommSync uses NextAuth.js (Auth.js) for authentication with dual authentication methods:

1. **Email/Password Authentication** (Primary method)
2. **Google OAuth** (Secondary method with restricted scope)

The authentication system is designed to be secure, user-friendly, and easily extendable. It integrates with our Prisma database and includes support for email notifications.

## Implementation Details

### Core Components

- **Authentication Provider**: Uses NextAuth.js with JWT strategy and custom callbacks
- **Database Integration**: Uses Prisma adapter to store user information
- **Password Handling**: Secure password hashing with bcrypt
- **Email Notifications**: SendGrid integration for welcome emails and verification

### File Structure

```
├── lib/
│   ├── auth.ts                  # Main authentication configuration
│   ├── auth-options.ts          # Compatibility file (deprecated)
│   ├── auth-utils.ts            # Utility functions for authentication
│   └── email.ts                 # Email functionality with SendGrid
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/   # NextAuth API routes
│   │   └── register/            # User registration API
│   ├── login/                   # Login page
│   └── register/                # Registration page
└── components/
    ├── login-form.tsx           # Login form component
    └── register-form.tsx        # Registration form component
```

## Authentication Configuration

The main authentication configuration is defined in `lib/auth.ts`:

```typescript
// Simplified version
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      // Email/password authentication
    }),
    GoogleProvider({
      // Google OAuth with restricted scope
    }),
  ],
  callbacks: {
    // Custom callbacks for session, JWT, etc.
  }
};
```

### Credentials Provider

Email and password authentication is implemented using the built-in CredentialsProvider:

```typescript
CredentialsProvider({
  id: "credentials",
  name: "Email",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials) {
    // Validate credentials, find user, verify password
  }
})
```

### Google OAuth Provider

Google OAuth is configured with minimal scope (only `openid`):

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: "openid",
      prompt: "consent",
      access_type: "offline",
      response_type: "code",
    },
  }
})
```

## Database Schema

The user model in Prisma is extended to support password-based authentication:

```prisma
model User {
  id                 String    @id @default(cuid())
  name               String?
  email              String?   @unique
  emailVerified      DateTime?
  image              String?
  password           String?   // For credentials authentication
  // ... other fields
}
```

## Email Notifications

The system includes email functionality through SendGrid:

- **Welcome Emails**: Sent after successful registration
- **Verification Emails**: For account verification (future implementation)
- **Password Reset**: For password reset workflow (future implementation)
- **Subscription Confirmation**: Sent when a user subscribes to a plan

## User Flow

### Registration Flow

1. User fills out registration form with name, email, and password
2. Form performs validation (required fields, email format, password length)
3. On submit, password is hashed and user is created in the database
4. Welcome email is sent to the user
5. User is automatically redirected to the pricing page to select a plan

### Login Flow

1. User enters email and password or chooses Google sign-in
2. Credentials are validated against the database (for email/password)
3. On successful login, user is redirected to the dashboard or requested URL
4. Failed login attempts display appropriate error messages

## Security Considerations

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Tokens**: Session information is stored in JWT tokens with appropriate expiration
- **Limited OAuth Scope**: Google OAuth uses minimal permissions (only openid)
- **CSRF Protection**: Built-in protection via NextAuth.js
- **Rate Limiting**: Consider implementing rate limiting for login attempts (not yet implemented)

## Adding New Authentication Providers

To add a new authentication provider:

1. Install the required packages
2. Add the provider to the providers array in `lib/auth.ts`
3. Configure any specific parameters needed for the provider
4. Update the UI to include the new sign-in option

## Troubleshooting

Common issues and solutions:

- **Login fails silently**: Check database connection and ensure passwords are correctly hashed
- **Google login doesn't work**: Verify the Google OAuth credentials and callback URLs
- **JWT errors**: Check the AUTH_SECRET environment variable is properly set

## Future Improvements

- Implement email verification workflow
- Add password reset functionality
- Implement multi-factor authentication
- Add more OAuth providers (GitHub, Twitter, etc.)
- Implement account linking (connect multiple providers to one account)

## Environment Variables

Required environment variables:

```
# Database
DATABASE_URL=postgresql://...

# Authentication
AUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:3000 # For development

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
```

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [SendGrid Documentation](https://docs.sendgrid.com/)

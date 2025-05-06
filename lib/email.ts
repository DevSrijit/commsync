import sgMail from "@sendgrid/mail";

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Constants
const FROM_EMAIL = "commsync@havenmediasolutions.com";
const SUPPORT_EMAIL = "commsync@havenmediasolutions.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://commsync.gg";

// Email template for welcome email after registration
export async function sendWelcomeEmail(to: string, name: string) {
  const msg = {
    to,
    from: FROM_EMAIL,
    subject: "Welcome to CommSync!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to CommSync!</h2>
        <p>Hi ${name || "there"},</p>
        <p>Thank you for signing up for CommSync. We're excited to have you on board!</p>
        
        <p>CommSync helps you manage your communications across various platforms in one centralized place.</p>
        
        <p>To get started:</p>
        <ol>
          <li>Choose a subscription plan that fits your needs</li>
          <li>Connect your communication accounts</li>
          <li>Start synchronizing your messages</li>
        </ol>
        
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/pricing" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Choose a Plan
          </a>
        </div>
        
        <p>If you have any questions or need help getting started, please don't hesitate to contact our support team at ${SUPPORT_EMAIL}.</p>
        
        <p>Best regards,<br>The CommSync Team</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, error };
  }
}

// Email template for account verification
export async function sendVerificationEmail(to: string, token: string) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: "Verify Your CommSync Account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Verify Your Email</h2>
        <p>Please click the button below to verify your email address:</p>
        
        <div style="margin: 30px 0;">
          <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        
        <p>If you didn't create an account with CommSync, you can safely ignore this email.</p>
        
        <p>Best regards,<br>The CommSync Team</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return { success: false, error };
  }
}

// Email template for password reset
export async function sendPasswordResetEmail(to: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: "Reset Your CommSync Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Reset Your Password</h2>
        <p>We received a request to reset your password for your CommSync account.</p>
        <p>Please click the button below to create a new password:</p>
        
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>The link will expire in 1 hour for security reasons.</p>
        
        <p>Best regards,<br>The CommSync Team</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error };
  }
}

// Email template for subscription confirmation
export async function sendSubscriptionConfirmationEmail(
  to: string,
  name: string,
  planType: string,
  endDate: Date
) {
  const formattedDate = new Date(endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: "Your CommSync Subscription Confirmation",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Subscription Confirmed</h2>
        <p>Hi ${name || "there"},</p>
        <p>Thank you for subscribing to CommSync's ${planType} plan!</p>
        
        <p>Your subscription is now active and will renew automatically on ${formattedDate}.</p>
        
        <p>You can manage your subscription, including billing information and plan changes, from your account settings.</p>
        
        <div style="margin: 30px 0;">
          <a href="${APP_URL}/dashboard" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
        
        <p>If you have any questions about your subscription or need assistance, please contact our support team at ${SUPPORT_EMAIL}.</p>
        
        <p>Best regards,<br>The CommSync Team</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending subscription confirmation email:", error);
    return { success: false, error };
  }
}

// Generic template for sending custom emails
export async function sendCustomEmail(
  to: string,
  subject: string,
  htmlContent: string
) {
  const msg = {
    to,
    from: FROM_EMAIL,
    subject,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error("Error sending custom email:", error);
    return { success: false, error };
  }
}

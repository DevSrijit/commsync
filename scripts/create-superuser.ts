import { PrismaClient } from "@prisma/client";
import { STRIPE_PLANS } from "../lib/stripe";
import { stdin, stdout } from "process";
import { createInterface } from "readline";

// Create a new Prisma client
const db = new PrismaClient();

// Create readline interface for CLI input
const rl = createInterface({
  input: stdin,
  output: stdout,
});

// Promisify the question function
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function createSuperUser(email: string) {
  try {
    // Find the user
    const user = await db.user.findUnique({
      where: { email },
      include: {
        organizations: true,
        ownedOrganizations: true,
      },
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }

    console.log(`Found user: ${user.name || user.email}`);

    // Create a super user organization
    const superOrgName = `${user.name || user.email}'s Super User Access`;
    const organization = await db.organization.create({
      data: {
        name: superOrgName,
        ownerId: user.id,
        members: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    console.log(`Created organization: ${organization.name}`);

    // Get business plan limits as a starting point
    const businessLimits = STRIPE_PLANS.business.limits;

    // Create a super user subscription with extremely high limits
    const superUserSubscription = await db.subscription.create({
      data: {
        organizationId: organization.id,
        stripeSubscriptionId: `superuser_${user.id}`,
        stripePriceId: "price_superuser_free",
        status: "active",
        currentPeriodStart: new Date(),
        // Set expiration far in the future (10 years)
        currentPeriodEnd: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        planType: "business", // Use business plan type as requested

        // Set high limits (10x business plan)
        maxUsers: 100,
        maxStorage: businessLimits.maxStorage * 10,
        maxConnections: businessLimits.maxConnections * 10,
        totalStorage: businessLimits.maxStorage * 10,
        totalConnections: businessLimits.maxConnections * 10,
        totalAiCredits: businessLimits.totalAiCredits * 10,

        // Initialize usage stats
        usedStorage: 0,
        usedConnections: 0,
        usedAiCredits: 0,

        // Add custom metadata
        customLimits: {
          isSuperUser: true,
          createdAt: new Date().toISOString(),
          createdBy: "admin",
          notes: "Unlimited access super user",
        },
      },
    });

    console.log(
      `Created super user subscription with ID: ${superUserSubscription.id}`
    );
    console.log(`
Super User Details:
- User: ${user.email} (${user.id})
- Organization: ${organization.name} (${organization.id})
- Subscription: ${superUserSubscription.id}
- Plan Type: ${superUserSubscription.planType} (with super user privileges)
- Expiration: ${superUserSubscription.currentPeriodEnd.toISOString()}
- Storage Limit: ${superUserSubscription.totalStorage}MB
- Connection Limit: ${superUserSubscription.totalConnections}
- AI Credits: ${superUserSubscription.totalAiCredits}
`);

    return superUserSubscription;
  } catch (error) {
    console.error("Error creating super user:", error);
  } finally {
    // Close the Prisma client
    await db.$disconnect();
  }
}

// Command line interface for the script
async function main() {
  try {
    const email = await question(
      "Enter the email of the user to make a super user: "
    );
    if (!email) {
      console.error("Email is required");
      rl.close();
      return;
    }

    await createSuperUser(email);
    console.log(`Successfully created super user access for ${email}`);
  } catch (error) {
    console.error("Failed to create super user:", error);
  } finally {
    rl.close();
  }
}

// Run the script
main();

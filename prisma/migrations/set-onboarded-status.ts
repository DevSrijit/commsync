import { PrismaClient } from "@prisma/client";

/**
 * This script sets the isOnboarded status for existing users.
 * - Users with subscriptions are marked as onboarded (true)
 * - Users without subscriptions are marked as not onboarded (false)
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    console.log("Starting onboarding status migration...");

    // Get all organizations with subscriptions
    const orgsWithSubscriptions = await prisma.organization.findMany({
      where: {
        subscription: {
          isNot: null,
        },
      },
      include: {
        members: true,
        owner: true,
      },
    });

    console.log(
      `Found ${orgsWithSubscriptions.length} organizations with subscriptions`
    );

    // Set of user IDs who are onboarded
    const onboardedUserIds = new Set<string>();

    // Mark all members and owners of subscribed organizations as onboarded
    for (const org of orgsWithSubscriptions) {
      // Add owner to onboarded set
      if (org.owner) {
        onboardedUserIds.add(org.owner.id);
      }

      // Add all members to onboarded set
      for (const member of org.members) {
        onboardedUserIds.add(member.id);
      }
    }

    console.log(`Found ${onboardedUserIds.size} users to mark as onboarded`);

    // Update all onboarded users
    if (onboardedUserIds.size > 0) {
      await prisma.user.updateMany({
        where: {
          id: {
            in: Array.from(onboardedUserIds),
          },
        },
        data: {
          isOnboarded: true,
        },
      });
      console.log(
        `Successfully marked ${onboardedUserIds.size} users as onboarded`
      );
    }

    // Get total user count
    const totalUsers = await prisma.user.count();
    console.log(`Total users in system: ${totalUsers}`);

    // Set remaining users as not onboarded
    const unboardedCount = await prisma.user.updateMany({
      where: {
        id: {
          notIn: Array.from(onboardedUserIds),
        },
        isOnboarded: {
          equals: null,
        },
      },
      data: {
        isOnboarded: false,
      },
    });

    console.log(`Set ${unboardedCount.count} users as not onboarded`);
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Error in migration:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

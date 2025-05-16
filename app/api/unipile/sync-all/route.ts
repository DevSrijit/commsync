import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileService } from "@/lib/unipile-service";
import { db } from "@/lib/db";

// API endpoint to sync all Unipile-connected platforms at once
export async function GET() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all connected Unipile accounts for this user
    const accounts = await db.unipileAccount.findMany({
      where: {
        userId: session.user.id,
        status: "connected", // Only get connected accounts
      },
    });

    console.log(`Found ${accounts.length} connected Unipile accounts to sync`);

    // Get the Unipile service instance
    const unipileService = getUnipileService();

    // Start syncing each account
    const syncResults = await Promise.all(
      accounts.map(async (account: any) => {
        try {
          if (!account.accountIdentifier) {
            return {
              id: account.id,
              provider: account.provider,
              success: false,
              error: "No account identifier",
            };
          }

          console.log(`Syncing ${account.provider} account: ${account.id}`);
          await unipileService.syncUnipileMessages(
            account.id,
            account.accountIdentifier
          );

          // Update lastSync timestamp
          await db.unipileAccount.update({
            where: { id: account.id },
            data: { lastSync: new Date() },
          });

          return { id: account.id, provider: account.provider, success: true };
        } catch (error) {
          console.error(`Error syncing account ${account.id}:`, error);
          return {
            id: account.id,
            provider: account.provider,
            success: false,
            error: String(error),
          };
        }
      })
    );

    const successCount = syncResults.filter((result) => result.success).length;

    return NextResponse.json({
      success: true,
      message: `Synced ${successCount}/${accounts.length} Unipile accounts`,
      results: syncResults,
    });
  } catch (error) {
    console.error("Error in Unipile sync-all endpoint:", error);
    return NextResponse.json(
      { error: "Failed to sync Unipile accounts" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileService } from "@/lib/unipile-service";

export async function GET(request: NextRequest) {
  try {
    console.log("Checking WhatsApp connection status...");

    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("Unauthorized: No valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the account ID from the request
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) {
      console.log("Bad request: No accountId provided");
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `Checking status for accountId: ${accountId}, userId: ${session.user.id}`
    );

    // Get the Unipile service instance
    const unipileService = getUnipileService();

    // Check the connection status
    const status = await unipileService.checkConnectionStatus(accountId);
    console.log(`Status check result: ${JSON.stringify(status)}`);

    return NextResponse.json(status);
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    console.error(
      `Error checking WhatsApp connection status: ${errorMessage}`,
      error
    );

    return NextResponse.json(
      {
        error: "Failed to check connection status",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

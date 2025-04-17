import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNylasAuthUrl } from "@/lib/nylas-service";

export async function GET(request: NextRequest) {
  try {
    // Verify that the user is logged in
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get label from query parameters
    const searchParams = request.nextUrl.searchParams;
    const label = searchParams.get("label") || "Outlook Account";

    // Create the redirect URI
    const redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/nylas/auth/callback`
      : `${request.nextUrl.origin}/api/nylas/auth/callback`;

    // Generate the Nylas auth URL
    const authUrl = await createNylasAuthUrl(redirectUri);

    // Use state parameter to pass account label
    const finalAuthUrl = `${authUrl}&state=${encodeURIComponent(label)}`;

    // Redirect to Nylas auth page
    return NextResponse.redirect(finalAuthUrl);
  } catch (error) {
    console.error("Error initiating Nylas auth:", error);

    return NextResponse.json(
      {
        error: "Failed to initiate authentication",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { exchangeCodeForGrant } from "@/lib/nylas-service";

export async function GET(request: NextRequest) {
  try {
    // Get the authorization code from the URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const label = searchParams.get("state") || "Outlook Account"; // Use state for account label

    // Check for errors or missing code
    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_code", request.url)
      );
    }

    // Get the user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", request.url)
      );
    }

    // Create the redirect URI (must match the one used to initiate the flow)
    const redirectUri = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/nylas/auth/callback`
      : `${request.nextUrl.origin}/api/nylas/auth/callback`;

    // Exchange the code for a grant ID
    const { grantId, email, provider } = await exchangeCodeForGrant(
      code,
      redirectUri
    );

    // Save the account in our database
    const syncAccount = await db.syncAccount.create({
      data: {
        userId: session.user.id,
        label: `${label} (${email})`,
        platform: "nylas",
        accountIdentifier: email,
        credentials: JSON.stringify({
          grantId,
          email,
          provider,
        }),
        settings: JSON.stringify({
          provider,
        }),
        lastSync: new Date(),
      },
    });

    console.log(
      `Successfully linked Nylas account for ${email} with grant ID ${grantId}`
    );

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL(
        `/settings?success=account_linked&email=${encodeURIComponent(email)}`,
        request.url
      )
    );
  } catch (error) {
    console.error("Error in Nylas auth callback:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}

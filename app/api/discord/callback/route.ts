import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import axios from "axios";

export async function GET(req: NextRequest) {
  try {
    // Get the auth session to ensure user is logged in
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL(
          `/login?error=Unauthorized&message=You must be logged in to link a Discord account`,
          req.url
        )
      );
    }

    const userId = session.user.id;

    // Get auth code from Discord OAuth
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=DiscordAuthError&message=${error}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=MissingCode&message=No authorization code received from Discord`,
          req.url
        )
      );
    }

    // Parse the state parameter for the account label
    let label = "Discord Account";
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        label = stateData.label || label;
      }
    } catch (error) {
      console.error("Error parsing state parameter:", error);
    }

    // Exchange the code for an access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/discord/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Discord token exchange error:", errorData);
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=TokenExchangeError&message=Failed to get Discord token: ${errorData.error}`,
          req.url
        )
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Discord
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error("Discord user info error:", errorData);
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=UserInfoError&message=Failed to get Discord user info: ${errorData.error}`,
          req.url
        )
      );
    }

    const userData = await userResponse.json();

    // Calculate token expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Create Discord account in database
    const discordAccount = await db.discordAccount.create({
      data: {
        userId,
        label,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        discordUserId: userData.id,
        discordUserTag: userData.username,
      },
    });

    // Register the account with the Discord middleware
    try {
      const middlewareUrl =
        process.env.DISCORD_MIDDLEWARE_URL || "http://localhost:3001";
      await axios.post(`${middlewareUrl}/register`, {
        accountId: discordAccount.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: expiresAt.toISOString(),
        discordUserId: userData.id,
      });

      console.log(
        `Discord account ${discordAccount.id} registered with middleware`
      );
    } catch (middlewareError) {
      console.error(
        "Error registering with Discord middleware:",
        middlewareError
      );
      // We'll continue even if middleware registration fails - we can try again later
    }

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      new URL(
        `/dashboard?success=DiscordLinked&message=Discord account linked successfully`,
        req.url
      )
    );
  } catch (error) {
    console.error("Error in Discord callback:", error);

    return NextResponse.redirect(
      new URL(
        `/dashboard?error=ServerError&message=An error occurred while linking your Discord account`,
        req.url
      )
    );
  }
}

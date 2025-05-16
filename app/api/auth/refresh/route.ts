import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Track refresh attempts
const refreshStats = {
  totalCalls: 0,
  successfulRefreshes: 0,
  recentCalls: [] as { time: number; user: string }[],
  lastLogged: Date.now(),
};

// Rate limiting and debouncing implementation
const refreshCache = new Map<
  string,
  {
    lastRefreshTime: number;
    inProgress: boolean;
    token?: string;
    expiresAt?: number;
  }
>();

// Token refresh cooldown period (in milliseconds)
const REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Increment the call counter
    refreshStats.totalCalls++;
    const now = Date.now();

    // Get provider from query parameter
    const provider = request.nextUrl.searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    // Get the current session
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user info for caching
    const userId = session.user.id;
    const userEmail = session.user.email || "unknown";
    const cacheKey = `${provider}:${userId}`;

    // Add to recent calls
    refreshStats.recentCalls.push({
      time: now,
      user: userEmail,
    });

    // For Google provider, attempt to refresh the token
    if (provider === "google") {
      // Check the cache first for recent refreshes
      const cachedRefresh = refreshCache.get(cacheKey);

      if (cachedRefresh) {
        // If a refresh was done recently, return the cached token
        if (now - cachedRefresh.lastRefreshTime < REFRESH_COOLDOWN) {
          // If we have a cached token that's still valid, return it
          if (cachedRefresh.token && cachedRefresh.expiresAt) {
            return NextResponse.json({
              message: "Using cached token from recent refresh",
              provider,
              accessToken: cachedRefresh.token,
              expiresAt: cachedRefresh.expiresAt,
              cached: true,
              success: true,
            });
          }
        }

        // If a refresh is already in progress, wait for it to complete
        if (cachedRefresh.inProgress) {
          // Wait up to 5 seconds for the token refresh to complete
          let attempts = 0;
          while (attempts < 50) {
            // Check if the refresh is still in progress
            const currentState = refreshCache.get(cacheKey);
            if (!currentState?.inProgress && currentState?.token) {
              return NextResponse.json({
                message: "Token refresh completed while waiting",
                provider,
                accessToken: currentState.token,
                expiresAt: currentState.expiresAt,
                success: true,
              });
            }

            // Wait 100ms before checking again
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }

          // If we timed out waiting, return an error
          console.error(
            `[TOKEN-REFRESH] Timed out waiting for refresh to complete for ${userEmail}`
          );
          return NextResponse.json(
            {
              error: "Token refresh in progress, but timed out waiting",
              message: "Please try again in a few seconds",
            },
            { status: 429 }
          );
        }
      }

      // Mark refresh as in progress
      refreshCache.set(cacheKey, {
        lastRefreshTime: now,
        inProgress: true,
      });

      // Check if we have a refresh token
      if (!session.user.refreshToken) {
        console.error(
          "[TOKEN-REFRESH] No refresh token available for Google account"
        );

        // Update cache to indicate refresh is no longer in progress
        const entry = refreshCache.get(cacheKey);
        if (entry) {
          refreshCache.set(cacheKey, {
            ...entry,
            inProgress: false,
          });
        }

        return NextResponse.json(
          {
            error: "No refresh token available",
            message: "You need to re-authenticate with Google",
            provider,
          },
          { status: 401 }
        );
      }

      try {
        // Call Google's token endpoint to refresh the token
        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || "",
              client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
              refresh_token: session.user.refreshToken,
              grant_type: "refresh_token",
            }),
          }
        );

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          console.error(
            "[TOKEN-REFRESH] Google token refresh failed:",
            errorData
          );

          // Update cache to indicate refresh is no longer in progress
          const entry = refreshCache.get(cacheKey);
          if (entry) {
            refreshCache.set(cacheKey, {
              ...entry,
              inProgress: false,
            });
          }

          return NextResponse.json(
            {
              error: "Token refresh failed",
              details: errorData,
            },
            { status: tokenResponse.status }
          );
        }

        const tokenData = await tokenResponse.json();

        // Calculate new expiration timestamp
        const expiresAt = Math.floor(Date.now() / 1000 + tokenData.expires_in);

        // IMPORTANT: Update the account with the new token
        if (session.user.id) {
          // Find the account in the database
          const account = await db.account.findFirst({
            where: {
              userId: session.user.id,
              provider: "google",
            },
          });

          if (account) {
            // Update the account with the new token
            await db.account.update({
              where: { id: account.id },
              data: {
                access_token: tokenData.access_token,
                expires_at: expiresAt,
              },
            });

            // Update the cache with the new token
            refreshCache.set(cacheKey, {
              lastRefreshTime: now,
              inProgress: false,
              token: tokenData.access_token,
              expiresAt,
            });

            // Increment successful refreshes counter
            refreshStats.successfulRefreshes++;

            // Return the new token in the response
            return NextResponse.json({
              message: "Token refresh completed successfully",
              provider,
              accessToken: tokenData.access_token,
              expiresAt,
              success: true,
            });
          } else {
            console.error("[TOKEN-REFRESH] Google account not found for user");

            // Update cache to indicate refresh is no longer in progress
            const entry = refreshCache.get(cacheKey);
            if (entry) {
              refreshCache.set(cacheKey, {
                ...entry,
                inProgress: false,
              });
            }

            return NextResponse.json(
              {
                error: "Account not found in database",
                message: "You may need to re-authenticate with Google",
              },
              { status: 404 }
            );
          }
        } else {
          console.error("[TOKEN-REFRESH] User ID not found in session");

          // Update cache to indicate refresh is no longer in progress
          const entry = refreshCache.get(cacheKey);
          if (entry) {
            refreshCache.set(cacheKey, {
              ...entry,
              inProgress: false,
            });
          }

          return NextResponse.json(
            {
              error: "User not found",
              message: "Session user ID is missing",
            },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("[TOKEN-REFRESH] Error refreshing Google token:", error);

        // Update cache to indicate refresh is no longer in progress
        const entry = refreshCache.get(cacheKey);
        if (entry) {
          refreshCache.set(cacheKey, {
            ...entry,
            inProgress: false,
          });
        }

        return NextResponse.json(
          {
            error: "Token refresh failed",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    } else {
      // For other providers
      return NextResponse.json({
        message: "Token refresh initiated",
        provider,
        success: true,
      });
    }
  } catch (error) {
    console.error("[TOKEN-REFRESH] Error in token refresh:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

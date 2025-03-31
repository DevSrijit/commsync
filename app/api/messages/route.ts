import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { TwilioService } from "@/lib/twilio-service";
import { JustCallService } from "@/lib/justcall-service";

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const limit = parseInt(searchParams.get("limit") || "100");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    const phoneNumber = searchParams.get("phoneNumber");
    const accountId = searchParams.get("accountId");
    const sortDirection =
      (searchParams.get("sortDirection") as "asc" | "desc") || "desc";
    const lastSmsIdFetched = searchParams.get("lastSmsIdFetched");

    if (!platform) {
      return NextResponse.json(
        { error: "Platform parameter is required" },
        { status: 400 }
      );
    }

    // Get accounts for the specified platform
    const accountsQuery: any = {
      userId: session.user.id,
      platform: platform.toLowerCase(),
    };

    // If accountId is specified, filter to just that account
    if (accountId) {
      accountsQuery.id = accountId;
    }

    const accounts = await db.syncAccount.findMany({
      where: accountsQuery,
    });

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    let allMessages: any[] = [];

    // Fetch messages from each account
    for (const account of accounts) {
      try {
        let messages: any[] = [];

        if (platform.toLowerCase() === "twilio") {
          const twilioService = new TwilioService(account);
          messages = await twilioService.getMessages(undefined, limit);
        } else if (platform.toLowerCase() === "justcall") {
          const justcallService = new JustCallService(account);

          // For JustCall, use the phoneNumber from query params or the accountIdentifier
          const phoneToUse = phoneNumber || account.accountIdentifier;

          if (!phoneToUse) {
            console.warn(
              `No phone number specified for JustCall account ${account.id}, skipping`
            );
            continue;
          }

          console.log(`Fetching messages for JustCall account ${account.id}:`);
          console.log(`- Phone: ${phoneToUse}`);
          console.log(`- Sort direction: ${sortDirection}`);
          console.log(
            `- Pagination cursor (lastSmsIdFetched): ${
              lastSmsIdFetched || "none"
            }`
          );

          // Use cursor-based pagination with lastSmsIdFetched instead of page numbers
          const result = await justcallService.getMessages(
            phoneToUse,
            undefined, // No date filtering
            pageSize,
            lastSmsIdFetched || undefined,
            sortDirection as "asc" | "desc"
          );

          // Extract messages and rate limit info
          const {
            messages: justcallMessages,
            rateLimited,
            retryAfter,
          } = result;

          // Log rate limit status if it's close to being reached
          if (rateLimited) {
            console.warn(
              `⚠️ JustCall API rate limit reached for account ${account.id}`
            );
            if (retryAfter) {
              console.warn(
                `   Recommended to retry after ${retryAfter} seconds`
              );

              // Add rate limit info to global state
              // Will be used later for headers in the final response
              (global as any).justcallRateLimitReset = retryAfter;
              (global as any).justcallRateLimited = true;
            }
          }

          console.log(
            `Retrieved ${justcallMessages.length} messages from JustCall`
          );

          // Log the ID range to help with troubleshooting pagination
          if (justcallMessages.length > 0) {
            const firstId = justcallMessages[0].id;
            const lastId = justcallMessages[justcallMessages.length - 1].id;
            console.log(`Message ID range: ${firstId} - ${lastId}`);
          }

          // Add messages to our collection (even if partial due to rate limiting)
          messages = justcallMessages.map((msg) => ({
            ...msg,
            accountId: account.id,
          }));
        }

        // Add account ID to each message for reference
        messages = messages.map((msg) => ({
          ...msg,
          accountId: account.id,
        }));

        allMessages = [...allMessages, ...messages];
      } catch (error) {
        console.error(
          `Error fetching messages from ${platform} account ${account.id}:`,
          error
        );
        // Continue with other accounts
      }
    }

    // For JustCall with cursor-based pagination, we don't need to apply additional pagination
    if (platform.toLowerCase() === "justcall") {
      // Create headers object for rate limit info if needed
      const responseHeaders: HeadersInit = {};

      // Add rate limit headers if we encountered rate limiting
      if ((global as any).justcallRateLimited) {
        responseHeaders["X-RateLimit-Warning"] = "true";

        if ((global as any).justcallRateLimitReset) {
          responseHeaders["X-RateLimit-Reset"] = (
            global as any
          ).justcallRateLimitReset.toString();
        }

        // Reset the global state
        (global as any).justcallRateLimited = false;
        (global as any).justcallRateLimitReset = undefined;
      }

      return NextResponse.json(
        {
          messages: allMessages,
          total: allMessages.length,
        },
        { headers: responseHeaders }
      );
    }

    // Apply pagination to the results for other platforms
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMessages = allMessages.slice(startIndex, endIndex);

    return NextResponse.json({
      messages: paginatedMessages,
      total: allMessages.length,
      page,
      pageSize,
      totalPages: Math.ceil(allMessages.length / pageSize),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

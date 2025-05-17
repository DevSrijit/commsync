import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnipileService } from "@/lib/unipile-service";

/**
 * API endpoint to trigger a bulk sync of all messages from WhatsApp.
 * This is typically used when first linking an account to fetch full history.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  const { accountId } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  try {
    // Validate that this account belongs to the current user
    const account = await db.syncAccount.findUnique({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: "whatsapp",
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found or unauthorized" },
        { status: 404 }
      );
    }

    // Use the Unipile account ID stored in accountIdentifier for API calls
    const unipileAccountId = account.accountIdentifier;

    const baseUrl = process.env.UNIPILE_BASE_URL;
    const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
    if (!baseUrl || !accessToken) {
      return NextResponse.json(
        { error: "Missing UNIPILE_BASE_URL or UNIPILE_ACCESS_TOKEN" },
        { status: 500 }
      );
    }

    // Create service
    const service = new UnipileService({ baseUrl, accessToken });

    // Results tracking
    const results = {
      totalChats: 0,
      processedChats: 0,
      totalMessages: 0,
      chatDetails: [] as any[],
    };

    // Fetch all chats
    const chatsResponse = await service.getAllWhatsAppChats(unipileAccountId);

    if (
      !chatsResponse ||
      !chatsResponse.chats ||
      !Array.isArray(chatsResponse.chats)
    ) {
      return NextResponse.json(
        { error: "Failed to fetch chats", details: chatsResponse },
        { status: 500 }
      );
    }

    const { chats } = chatsResponse;
    results.totalChats = chats.length;

    // Process each chat's messages with large batch size for full history
    // This is resource-intensive but necessary for initial sync
    for (const chat of chats) {
      try {
        const chatId = chat.id;
        if (!chatId) continue;

        // Set a large limit for initial sync (adjust as needed based on API limits)
        const messagesResponse = await service.getWhatsAppMessages(chatId, {
          limit: 1000, // Use a large limit for bulk sync
          sortDirection: "desc", // Get newest first
          accountId: unipileAccountId, // Use Unipile account ID for proper routing
        });

        // Handle the updated response format
        let messageCount = 0;
        if (
          messagesResponse &&
          messagesResponse.messages &&
          Array.isArray(messagesResponse.messages)
        ) {
          messageCount = messagesResponse.messages.length;
        }

        // Track results
        results.totalMessages += messageCount;
        results.processedChats++;

        results.chatDetails.push({
          chatId,
          title: chat.title || chatId,
          messageCount,
        });
      } catch (chatError) {
        console.error(
          `Error fetching messages for chat ${chat.id}:`,
          chatError
        );
        results.chatDetails.push({
          chatId: chat.id,
          error: String(chatError),
        });
      }
    }

    // Update the account's last sync time
    await db.syncAccount.update({
      where: { id: accountId },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      accountId,
      ...results,
    });
  } catch (error) {
    console.error("Error performing WhatsApp bulk sync:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk sync", details: String(error) },
      { status: 500 }
    );
  }
}

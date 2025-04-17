import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NylasService } from "@/lib/nylas-service";

export async function POST(request: NextRequest) {
  try {
    // Verify that the user is logged in
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { accountId, to, cc, bcc, subject, content, attachments } = body;

    if (!accountId || !to || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find the Nylas account in our database
    const syncAccount = await db.syncAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
        platform: "nylas",
      },
    });

    if (!syncAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Initialize the Nylas service
    const nylasService = new NylasService(syncAccount);

    // Send the email
    const sentMessage = await nylasService.sendMessage({
      to,
      cc,
      bcc,
      subject: subject || "(No Subject)",
      body: content,
      attachments,
    });

    // Save the sent message to our database for conversation tracking
    const senderEmail = syncAccount.accountIdentifier;

    // Find primary recipient for conversation tracking
    const primaryRecipient = Array.isArray(to) ? to[0] : to;
    const recipientEmail =
      typeof primaryRecipient === "string"
        ? primaryRecipient.replace(/.*<(.+@.+)>.*/, "$1").trim() // Extract email from "Name <email>" format
        : primaryRecipient.email || "";

    const recipientName =
      typeof primaryRecipient === "string"
        ? primaryRecipient.match(/^([^<]+)/)
          ? primaryRecipient.match(/^([^<]+)/)?.[1]?.trim() || ""
          : ""
        : primaryRecipient.name || "";

    // Find or create contact
    let contact = await db.contact.findFirst({
      where: {
        userId: session.user.id,
        email: recipientEmail,
      },
    });

    if (!contact) {
      contact = await db.contact.create({
        data: {
          userId: session.user.id,
          name: recipientName || recipientEmail,
          email: recipientEmail,
          senders: {
            create: {
              platform: "nylas",
              identifier: recipientEmail,
            },
          },
        },
      });
    }

    // Find or create conversation
    let conversation = await db.conversation.findFirst({
      where: {
        contactId: contact.id,
      },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          contactId: contact.id,
          title: `Conversation with ${contact.name}`,
        },
      });
    }

    // Store message in database
    await db.message.create({
      data: {
        conversationId: conversation.id,
        syncAccountId: syncAccount.id,
        platform: "nylas",
        externalId: sentMessage.id,
        direction: "outbound",
        content: content,
        contentType: "html",
        metadata: JSON.stringify(sentMessage),
        attachments:
          attachments && attachments.length > 0
            ? JSON.stringify(attachments)
            : null,
        sentAt: new Date(),
        isRead: true,
      },
    });

    // Update conversation last activity
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastActivity: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: sentMessage,
    });
  } catch (error) {
    console.error("Error sending email via Nylas:", error);

    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnipileService } from "@/lib/unipile-service";
import { MessageData } from "@/lib/messaging";

export async function POST(request: NextRequest) {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the message data from the request
    const messageData: MessageData = await request.json();

    // Validate required fields
    if (!messageData.content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    if (!messageData.accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Get the Unipile service
    const unipileService = getUnipileService();

    // Send the message
    const response = await unipileService.sendMessage(messageData);

    return NextResponse.json({
      success: true,
      messageId: response.id,
    });
  } catch (error) {
    console.error("Error sending Unipile message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

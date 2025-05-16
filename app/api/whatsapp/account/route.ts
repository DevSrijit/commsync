import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnipileClient } from "unipile-node-sdk";

export async function GET() {
  try {
    const accounts = await db.syncAccount.findMany({
      where: { platform: "whatsapp" },
      orderBy: { createdAt: "desc" },
    });

    const baseUrl = process.env.UNIPILE_BASE_URL;
    const accessToken = process.env.UNIPILE_ACCESS_TOKEN;
    if (!baseUrl || !accessToken) {
      return NextResponse.json(
        { error: "Missing UNIPILE_BASE_URL or UNIPILE_ACCESS_TOKEN" },
        { status: 500 }
      );
    }
    const client = new UnipileClient(baseUrl, accessToken);
    const detailedAccounts = await Promise.all(
      accounts.map(async (account: any) => {
        let phoneNumber: string | null = null;
        try {
          const unipileAcc: any = await client.account.getOne(account.id);
          // Try snake_case, camelCase, or name field for phone number
          const imParams = unipileAcc.connection_params?.im || {};
          phoneNumber =
            imParams.phone_number ||
            imParams.phoneNumber ||
            unipileAcc.name ||
            null;
        } catch (err) {
          console.error(
            `Failed to fetch WhatsApp account details for ${account.id}:`,
            err
          );
        }
        return { ...account, phoneNumber };
      })
    );
    return NextResponse.json(detailedAccounts);
  } catch (error) {
    console.error("Failed to fetch WhatsApp accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp accounts" },
      { status: 500 }
    );
  }
}

// Link a new WhatsApp account by saving the connect code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { code } = body;
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  try {
    const account = await db.syncAccount.create({
      data: {
        userId: session.user.id,
        platform: "whatsapp",
        credentials: JSON.stringify({ code }),
        accountIdentifier: code,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Failed to create WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 }
    );
  }
}

// Unlink an existing WhatsApp account
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await db.syncAccount.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete WhatsApp account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}

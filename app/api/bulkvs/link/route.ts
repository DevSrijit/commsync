import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { encryptData } from "@/lib/encryption";
import { BulkVSService } from "@/lib/bulkvs-service";

export async function POST(req: NextRequest) {
  try {
    // Get the user from the session
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const requestData = await req.json();

    // Validate input data
    const { label, apiKey, phoneNumber } = requestData;

    if (!label || !apiKey || !phoneNumber) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "Label, API key, and phone number are required",
        },
        { status: 400 }
      );
    }

    // Encrypt the credentials
    const credentials = encryptData(
      JSON.stringify({
        apiKey,
        phoneNumber,
      })
    );

    // Check if we already have an account with this phone number for this user
    const existingAccount = await db.syncAccount.findFirst({
      where: {
        userId,
        accountIdentifier: phoneNumber,
        platform: "bulkvs",
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        {
          error: "Account already exists",
          details:
            "A BulkVS account with this phone number is already connected",
        },
        { status: 400 }
      );
    }

    // Validate API key and phone number by making a test request
    try {
      // Create a sync account model for validation
      const testAccount = {
        id: "test",
        userId,
        platform: "bulkvs",
        accountIdentifier: phoneNumber,
        lastSync: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        credentials,
      };

      const bulkvsService = new BulkVSService(testAccount);

      // Make a test request to get the phone numbers
      const phoneNumbers = await bulkvsService.getPhoneNumbers();

      // Check if the provided phone number exists in the account
      let phoneNumberExists = false;
      let availableNumbers: string[] = [];

      if (Array.isArray(phoneNumbers)) {
        phoneNumbers.forEach((num: any) => {
          if (num.number) {
            availableNumbers.push(num.number);
            if (num.number === phoneNumber) {
              phoneNumberExists = true;
            }
          }
        });
      }

      if (!phoneNumberExists && availableNumbers.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid phone number",
            details:
              "The provided phone number does not exist in your BulkVS account",
            availableNumbers,
          },
          { status: 400 }
        );
      }
    } catch (validationError: any) {
      console.error("BulkVS validation error:", validationError);

      // Check for specific error types
      if (
        validationError.message?.includes("Unauthorized") ||
        validationError.message?.includes("401")
      ) {
        return NextResponse.json(
          { error: "Authentication failed", details: "Invalid API key" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: "Validation failed",
          details:
            validationError.message || "Could not validate BulkVS account",
        },
        { status: 400 }
      );
    }

    // Create the BulkVS account in the database
    const account = await db.syncAccount.create({
      data: {
        userId,
        platform: "bulkvs",
        accountIdentifier: phoneNumber,
        credentials,
        lastSync: new Date(),
        settings: { label },
      },
    });

    // Return success response with the account ID
    return NextResponse.json({
      id: account.id,
      message: "BulkVS account linked successfully",
    });
  } catch (error: any) {
    console.error("Error linking BulkVS account:", error);
    return NextResponse.json(
      { error: "Failed to link BulkVS account", details: error.message },
      { status: 500 }
    );
  }
}

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
    const {
      label,
      apiKey,
      phoneNumber,
      apiUsername,
    } = requestData;

    if (!label || !apiKey || !phoneNumber || !apiUsername) {
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
        apiUsername,
        useBasicAuth: true,
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

      console.log(
        `Validating BulkVS credentials for phone number: ${phoneNumber}`
      );

      // First check basic API connectivity
      const apiStatus = await bulkvsService.checkApiStatus();
      console.log(
        `BulkVS API status check: ${apiStatus.success ? "Success" : "Failed"}`
      );
      console.log(`Status message: ${apiStatus.message}`);

      if (!apiStatus.success) {
        throw new Error(
          `BulkVS API connectivity check failed: ${apiStatus.message}`
        );
      }

      try {
        // Make a test request to get the phone numbers
        const phoneNumbers = await bulkvsService.getPhoneNumbers();
        console.log(
          `Received ${phoneNumbers?.length || 0} phone numbers from BulkVS API`
        );

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

        // If no phone numbers were returned but there was no error, give a different message
        if (availableNumbers.length === 0) {
          console.warn("No phone numbers found in BulkVS account");

          // Try a simpler test request to verify API access
          try {
            console.log("Testing BulkVS API access with a debug request");
            const debugInfo = await bulkvsService.getAllMessagesDebug(1);

            // If we get here, the API is accessible but there might be no numbers
            console.log("BulkVS API is accessible but no phone numbers found");

            // Still allow account creation if they can access the API but have no numbers
            console.log(
              "Proceeding with account creation despite no phone numbers found"
            );
          } catch (debugApiError) {
            console.error("Debug API request also failed:", debugApiError);
            throw new Error(
              "Could not find any phone numbers in your BulkVS account. Please check your account status with BulkVS."
            );
          }
        }
      } catch (apiError: any) {
        // Handle specific API errors
        console.error("BulkVS API error:", apiError);
        throw apiError; // Pass the error to the outer catch block
      }
    } catch (validationError: any) {
      console.error("BulkVS validation error:", validationError);

      // Check for specific error types
      if (
        validationError.message?.includes("Unauthorized") ||
        validationError.message?.includes("401")
      ) {
        return NextResponse.json(
          {
            error: "Authentication failed",
            details:
              "Invalid credentials - please check your API username and API Password/Token",
          },
          { status: 401 }
        );
      }

      if (
        validationError.message?.includes("SyntaxError") ||
        validationError.message?.includes("Unexpected end of JSON")
      ) {
        return NextResponse.json(
          {
            error: "BulkVS API response error",
            details:
              "The BulkVS API returned an invalid response. Please check if your account has API access enabled or contact BulkVS support.",
          },
          { status: 400 }
        );
      }

      if (
        validationError.message?.includes("not found") ||
        validationError.message?.includes("404")
      ) {
        return NextResponse.json(
          {
            error: "BulkVS API endpoint not found",
            details:
              "The BulkVS API endpoint could not be found. Please check if your account has API access enabled or contact BulkVS support.",
          },
          { status: 404 }
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

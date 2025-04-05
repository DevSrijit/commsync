import { NextResponse } from "next/server";
import { Api } from "nocodb-sdk";

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }
    const api = new Api({
      baseURL: "https://nocodb.havenmediasolutions.com",
      headers: {
        "xc-token": process.env.NOCODB_API_TOKEN,
      },
    });

    console.log(`Submitting to NocoDB at: ${process.env.NOCODB_API_URL}`);

    // Submit data to NocoDB
    try {
      const response = await api.dbViewRow.create(
        "noco",
        "pcfst7afatuf5v1",
        "ml0unqpkoz3un2m",
        "vwe8tb6bnrp9gldq",
        { Name: name, Email: email, SubmittedAt: new Date().toISOString() }
      );

      console.log("NocoDB response:", response);

      return NextResponse.json(
        { success: true, message: "Successfully added to waitlist" },
        { status: 201 }
      );
    } catch (apiError: any) {
      console.error("NocoDB API Error:", {
        status: apiError.response?.status,
        data: apiError.response?.data,
        message: apiError.message,
      });

      return NextResponse.json(
        {
          error: "Failed to add to waitlist",
          details: apiError.response?.data || apiError.message,
        },
        { status: apiError.response?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error("Waitlist submission error:", error.message);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

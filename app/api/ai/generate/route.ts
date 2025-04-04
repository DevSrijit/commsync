import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";

// Force dynamic behavior for streaming responses
export const dynamic = "force-dynamic";

// Define the expected request body structure
interface GenerateMessageRequestBody {
  conversationContext: string;
  contactName: string;
  platform: string;
  customInstructions?: string;
}

export async function POST(req: Request) {
  try {
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OpenAI API key");
      return new NextResponse(
        JSON.stringify({
          error: "API configuration error",
          message: "The OpenAI API key is not configured.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Ensure the request method is POST
    if (req.method !== "POST") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }

    // Validate and parse the request body
    const body: GenerateMessageRequestBody = await req.json();
    const { conversationContext, contactName, platform, customInstructions } =
      body;

    // Check for valid context
    if (!conversationContext || typeof conversationContext !== "string") {
      return new NextResponse(
        JSON.stringify({ error: "Missing or invalid conversationContext" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Determine if we're generating for SMS or email
    const isSms = platform === "twilio" || platform === "justcall";

    try {
      // Use the Vercel AI SDK streamText function
      const result = await streamText({
        // Using a cost-effective and fast model suitable for message generation
        model: openai("gpt-4o-mini"),
        // Provide a system prompt to guide the AI based on platform
        system: isSms
          ? `You are an expert message composer specializing in short SMS-friendly messages.
             Based on the conversation history provided, generate a concise and friendly SMS response.
             The message should be short (limit to 160 characters when possible), direct, and appropriate for SMS.
             Only include the response text - no explanations, no quotes, no name at the end.
             Address the recipient, ${
               contactName || "the contact"
             }, appropriately.`
          : `You are an expert email composer.
             Based on the conversation history provided, generate a professional, friendly email response.
             The email should be concise, clear, and contextually appropriate.
             Include a proper greeting and sign-off, but avoid unnecessary formality.
             Only include the email body - no explanations, no "Subject:" line, no additional formatting.
             Address the recipient, ${
               contactName || "the contact"
             }, appropriately.`,
        // The main content for the AI to process
        prompt: `${conversationContext}
        
                ${
                  isSms
                    ? "Generate a brief SMS response appropriate for the conversation. Keep it concise and SMS-friendly."
                    : "Generate an email response appropriate for the conversation. Keep it professional but friendly."
                }
                
                ${
                  customInstructions
                    ? `Additional instructions: ${customInstructions}`
                    : ""
                }`,
        maxTokens: isSms ? 100 : 500,
      });

      // Stream the result back to the client
      return result.toDataStreamResponse();
    } catch (modelError: any) {
      // Specific handling for OpenAI API errors
      console.error("OpenAI API error:", modelError);

      // Try to extract a useful error message
      const errorMessage =
        modelError.message || "Unknown error calling OpenAI API";
      const statusCode = modelError.status || 500;

      // Check for specific API errors
      if (errorMessage.includes("API key")) {
        return new NextResponse(
          JSON.stringify({
            error: "API key error",
            message:
              "The OpenAI API key appears to be invalid. Please check your configuration.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (errorMessage.includes("rate limit")) {
        return new NextResponse(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: "OpenAI rate limit reached. Please try again later.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Generic API error
      return new NextResponse(
        JSON.stringify({
          error: "AI model error",
          message: errorMessage,
        }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: unknown) {
    console.error("Error in /api/ai/generate:", error);

    // Handle potential JSON parsing errors
    if (error instanceof SyntaxError) {
      return new NextResponse(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generic internal server error for other cases
    return new NextResponse(
      JSON.stringify({
        error: "Internal Server Error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

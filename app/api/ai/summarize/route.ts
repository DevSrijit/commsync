import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";

// Force dynamic behavior for streaming responses
export const dynamic = "force-dynamic";

// Define the expected request body structure
interface SummarizeRequestBody {
  conversationText: string;
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
    const body: SummarizeRequestBody = await req.json();
    const { conversationText } = body;

    if (
      !conversationText ||
      typeof conversationText !== "string" ||
      conversationText.trim().length === 0
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Missing or invalid conversationText" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      // Use the Vercel AI SDK streamText function
      const result = await streamText({
        // Using a cost-effective and fast model suitable for summarization
        // You might switch to 'gpt-4o' or others based on desired quality/cost
        model: openai("gpt-4o-mini"),
        // Provide a system prompt to guide the AI
        system: `You are an expert summarization assistant. 
               Analyze the following conversation and provide a concise summary (2-3 sentences maximum) 
               highlighting the key topics, decisions, or outcomes. 
               Focus on clarity and brevity. Respond only with the summary text.`,
        // The main content for the AI to process
        prompt: conversationText,
        maxTokens: 500,
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
    console.error("Error in /api/ai/summarize:", error);

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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100gb",
    },
  },
};

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMultipleCacheValues } from "@/lib/client-cache";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keys = searchParams.getAll("key");

    if (!keys.length) {
      return NextResponse.json(
        { error: "At least one key parameter is required" },
        { status: 400 }
      );
    }

    const values = await getMultipleCacheValues(keys, session.user.id);

    return NextResponse.json({ values });
  } catch (error: any) {
    console.error("Error in multiple cache GET:", error);
    return NextResponse.json(
      { error: "Failed to get multiple cache values", message: error.message },
      { status: 500 }
    );
  }
}

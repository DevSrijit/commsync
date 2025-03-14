import { Session } from "next-auth";
import { db } from "@/lib/db";

/**
 * Extracts the user ID from a Next.js session
 * @param session The authenticated session object
 * @returns The user ID string
 * @throws Error if user not found or session invalid
 */
export async function getUserIdFromSession(session: Session): Promise<string> {
  if (!session?.user?.email) {
    throw new Error("No user email found in session");
  }

  const user = await db.user.findUnique({
    where: {
      email: session.user.email,
    },
  });

  if (!user) {
    throw new Error("User not found in database");
  }

  return user.id;
}
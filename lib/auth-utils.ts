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

/**
 * Client-side utility to refresh the Google OAuth token
 * Call this when you get a 401 Unauthorized response
 * @returns Promise with success status and refreshed token if successful
 */
export async function refreshGoogleToken(): Promise<{ success: boolean; accessToken?: string }> {
  try {
    const response = await fetch('/api/auth/refresh?provider=google', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error('Token refresh failed:', await response.json());
      return { success: false };
    }
    
    const data = await response.json();
    return { 
      success: true, 
      accessToken: data.accessToken 
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return { success: false };
  }
}
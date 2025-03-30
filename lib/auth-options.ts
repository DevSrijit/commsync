import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

// Declare module augmentation to include custom properties
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accessToken?: string;
      refreshToken?: string;
    };
  }

  interface JWT {
    id?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://mail.google.com/",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // If we have a user, add the ID to the token
      if (user) {
        token.id = user.id;
      }
      
      // If we don't have a user ID in the token but have an email, look it up
      if (!token.id && token.email) {
        const dbUser = await db.user.findFirst({
          where: { email: token.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      // If we have an expiration time and the token is expired, try refreshing
      if (token.refreshToken && token.expiresAt && Date.now() >= (token.expiresAt as number) * 1000) {
        try {
          console.log("Token expired, refreshing...");
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID ?? "",
              client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
              refresh_token: token.refreshToken as string,
              grant_type: "refresh_token",
            }),
          });

          const refreshedTokens = await response.json();
          
          if (!response.ok) {
            console.error("Failed to refresh token:", refreshedTokens);
            return token;
          }

          console.log("Token refreshed successfully");
          
          // Update the token with new values
          token.accessToken = refreshedTokens.access_token;
          token.expiresAt = Math.floor(Date.now() / 1000) + refreshedTokens.expires_in;
          
          // Update the token in the database too
          if (token.id) {
            const account = await db.account.findFirst({
              where: {
                userId: token.id as string,
                provider: "google",
              },
            });
            
            if (account) {
              await db.account.update({
                where: { id: account.id },
                data: {
                  access_token: refreshedTokens.access_token,
                  expires_at: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
                },
              });
            }
          }
        } catch (error) {
          console.error("Error refreshing token:", error);
          // Return the existing token even if refresh failed
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.accessToken = token.accessToken as string;
        session.user.refreshToken = token.refreshToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
};

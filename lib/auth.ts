import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";

import { db } from "@/lib/db";

// Extend the Session interface to include custom properties
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
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://mail.google.com/",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
        session.user.accessToken = token.accessToken as string;
        session.user.refreshToken = token.refreshToken as string;
      }

      return session;
    },
    async jwt({ token, user, account }) {
      const dbUser = await db.user.findFirst({
        where: {
          email: token.email,
        },
      });

      if (!dbUser) {
        if (user) {
          token.id = user?.id;
        }
        return token;
      }

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      // Refresh expired token
      if (token.expiresAt && Date.now() > (token.expiresAt as number) * 1000) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: token.refreshToken as string,
              grant_type: "refresh_token",
            }),
          });

          const data = await response.json();
          token.accessToken = data.access_token;
          token.expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
        } catch (error) {
          console.error("Token refresh error:", error);
        }
      }

      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        picture: dbUser.image,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      };
    },
    async signIn({ user, account }) {
      try {
        // Find the user in the database
        const dbUser = await db.user.findUnique({
          where: { email: user.email! },
          include: {
            organizations: {
              include: {
                subscription: true,
              },
            },
          },
        });

        // Set email verification timestamp for all users
        if (dbUser && !dbUser.emailVerified) {
          await db.user.update({
            where: { id: dbUser.id },
            data: { emailVerified: new Date() },
          });
        }

        // Always return true to allow sign-in
        // The dashboard page will handle subscription checks and redirects
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return true; // Allow sign-in even on error, to avoid blocking users
      }
    },
  },
};

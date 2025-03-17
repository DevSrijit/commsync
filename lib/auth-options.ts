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

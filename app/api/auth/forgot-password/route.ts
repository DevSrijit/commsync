import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    // If no user found, we still return success to prevent user enumeration
    if (!user) {
      return NextResponse.json(
        {
          message:
            "If your email is in our system, you will receive a reset link shortly",
        },
        { status: 200 }
      );
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600 * 1000); // 1 hour from now

    // Store the token
    await db.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // Generate reset URL
    const resetUrl = `${
      process.env.NEXTAUTH_URL
    }/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Send email
    const emailResult = await sendPasswordResetEmail(
      user.email!,
      user.name || "User",
      resetUrl
    );

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      // Still return success to the client to prevent user enumeration
    }

    return NextResponse.json(
      { message: "Password reset email sent" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

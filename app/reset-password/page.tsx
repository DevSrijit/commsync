import { Metadata } from "next";
import ResetPasswordForm from "@/components/reset-password-form";

export const metadata: Metadata = {
    title: "Reset Password | CommSync",
    description: "Set a new password for your CommSync account",
};

export default function ResetPasswordPage({
    searchParams,
}: {
    searchParams: { token?: string; email?: string };
}) {
    return (
        <div className="container flex h-screen w-screen flex-col items-center justify-center">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                <ResetPasswordForm token={searchParams.token} email={searchParams.email} />
            </div>
        </div>
    );
} 
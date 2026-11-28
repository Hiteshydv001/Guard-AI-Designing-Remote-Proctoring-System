import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/landing/auth-layout";
import { InviteGate } from "@/components/landing/invite-gate";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthLayout label="[ get started ]" title={<>Exams you can trust, <span className="text-white/70">in minutes.</span></>}>
      <Suspense>
        <InviteGate>
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
        </InviteGate>
      </Suspense>
    </AuthLayout>
  );
}

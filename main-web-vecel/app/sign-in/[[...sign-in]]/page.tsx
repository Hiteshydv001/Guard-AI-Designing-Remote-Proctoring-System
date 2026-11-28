import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/landing/auth-layout";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthLayout label="[ welcome back ]" title={<>Pick up where <span className="text-white/70">you left off.</span></>}>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </AuthLayout>
  );
}

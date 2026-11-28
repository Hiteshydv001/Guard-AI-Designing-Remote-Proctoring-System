"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageError, FullPageSpinner, SessionEnded, useMe } from "@/components/app/role-gate";

/** Post-login landing: route the user to their role's dashboard (invited students are adopted by /api/me). */
export default function DashboardRedirect() {
  const router = useRouter();
  const { profile, error, signedOut, reload } = useMe();

  useEffect(() => {
    if (!profile) return;
    router.replace(!profile.role ? "/onboarding" : profile.role === "proctor" ? "/proctor" : "/candidate");
  }, [profile, router]);

  if (signedOut) return <SessionEnded />;
  if (error) return <FullPageError message={error} onRetry={reload} />;
  return <FullPageSpinner label="Opening your workspace…" />;
}

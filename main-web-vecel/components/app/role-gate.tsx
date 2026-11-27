"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { LogIn, ServerCrash } from "lucide-react";
import { ApiError, useApi } from "@/lib/api";
import type { Profile, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";

const ProfileContext = createContext<Profile | null>(null);
export const useProfile = () => useContext(ProfileContext);

export function useMe() {
  const api = useApi();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await api<Profile>("/api/me"));
      setSignedOut(false);
    } catch (e) {
      setError((e as Error).message);
      setSignedOut(e instanceof ApiError && e.status === 401);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, error, signedOut, loading, reload: load };
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="ambient flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="relative">
        <Image src="/logo.png" alt="" width={44} height={44} className="rounded-xl" />
        <span className="absolute -inset-2 animate-ping rounded-2xl border border-foreground/10" />
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export function FullPageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ambient flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ServerCrash className="h-6 w-6 text-destructive" />
      </span>
      <p className="max-w-md text-muted-foreground">{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Shown when the Clerk session is gone (signed out elsewhere, expired, or revoked). */
export function SessionEnded() {
  const { signOut } = useClerk();
  const next = typeof window !== "undefined" ? window.location.pathname : "/dashboard";
  return (
    <div className="ambient flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <LogIn className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">You&apos;ve been signed out</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your session ended, so we couldn&apos;t load your workspace. Sign in again to pick up where you left off.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => signOut({ redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(next)}` })}>Sign in again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

/** Loads the Guard AI profile and makes sure the user has the role this area needs. */
export function RoleGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const { profile, error, signedOut, loading, reload } = useMe();

  useEffect(() => {
    if (!profile) return;
    if (!profile.role) router.replace("/onboarding");
    else if (profile.role !== role) router.replace(profile.role === "proctor" ? "/proctor" : "/candidate");
  }, [profile, role, router]);

  if (signedOut) return <SessionEnded />;
  if (error) return <FullPageError message={error} onRetry={reload} />;
  if (loading || !profile || profile.role !== role) return <FullPageSpinner />;
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

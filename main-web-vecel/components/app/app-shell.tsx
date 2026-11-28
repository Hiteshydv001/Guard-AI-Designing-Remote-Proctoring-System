"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import { useProfile } from "./role-gate";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

function useActive() {
  const pathname = usePathname() || "";
  return (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({
  nav,
  role,
  footer,
  children,
}: {
  nav: NavItem[];
  role: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = useActive();
  const profile = useProfile();

  return (
    <div className="ambient min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-3 left-3 z-40 hidden w-[248px] flex-col rounded-[28px] border border-border/70 bg-card/90 p-3 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-3 py-3">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight">Guard AI</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{role}</span>
        </Link>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {footer}

        <div className="mt-3 flex items-center gap-3 rounded-[20px] bg-muted/60 p-2.5">
          <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.name || "Account"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
          <ToggleTheme />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={26} height={26} className="rounded-lg" />
          <span className="font-semibold tracking-tight">Guard AI</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ToggleTheme />
          <UserButton />
        </div>
      </header>

      <main className="px-4 pb-32 pt-6 sm:px-6 lg:ml-[264px] lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>

      {/* Mobile floating pill nav */}
      <nav className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:hidden">
        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/90 p-1.5 shadow-xl backdrop-blur-xl">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex h-12 items-center gap-2 rounded-full px-4 text-xs font-medium transition-all",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {active && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

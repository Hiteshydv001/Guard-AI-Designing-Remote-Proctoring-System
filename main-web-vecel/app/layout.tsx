import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap", adjustFontFallback: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "Guard AI — AI-proctored online exams", template: "%s · Guard AI" },
  description:
    "Run secure online exams with server-side AI proctoring, identity verification and live monitoring. Built for teachers, free to host.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      appearance={{
        // Dev instances otherwise stamp "Development mode" on every Clerk card; production instances never show it.
        layout: { unsafe_disableDevelopmentModeWarnings: true },
        variables: { borderRadius: "1rem", fontFamily: "var(--font-sans)" },
        elements: {
          card: "rounded-[28px] shadow-none border border-border/70",
          // The brand panel already carries the logo; Clerk's copy comes from its dashboard and is outdated.
          logoBox: "hidden",
          formButtonPrimary: "rounded-full bg-[#171311] hover:bg-[#171311]/85 normal-case text-sm",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={cn("min-h-screen font-sans", sans.variable, mono.variable)}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                classNames: {
                  toast: "rounded-2xl border border-border/70 bg-card text-foreground shadow-xl font-sans",
                  description: "text-muted-foreground",
                },
              }}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/layout/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Guard AI",
  description: "Proctoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch Clerk Frontend API key from the environment variables
  const clerkFrontendApi = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    console.log("Clerk publishable key:", clerkFrontendApi);


  return (
    // Pass the Clerk publishable key to ClerkProvider
    <ClerkProvider publishableKey={clerkFrontendApi}
    signInUrl="/signin"
    >
      <html lang="pt-br" suppressHydrationWarning>
        <body className={cn("min-h-screen bg-background", inter.className)}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Navbar />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

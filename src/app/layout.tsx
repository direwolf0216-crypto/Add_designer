import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Alex_Brush, Montserrat, Outfit } from "next/font/google";
// Icons: trimmed Phosphor fonts holding only the icons the app uses (scripts/icons/build-icons.mjs).
import "@/styles/icons/phosphor-regular.css";
import "@/styles/icons/phosphor-bold.css";
import "@/styles/icons/phosphor-fill.css";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cn } from "@/lib/utils";
import AppToaster from "@/components/ui/app-toaster";
import BootLoader from "@/components/motion/BootLoader";
import SavedDataProvider from "@/components/providers/SavedDataProvider";
import ServiceWorker from "@/components/providers/ServiceWorker";

// All app fonts load once here via next/font (self-hosted, no render-blocking @import).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
// Page titles: the rounded geometric face the sign-in page uses.
const display = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
// The brand wordmark's faces are rarely on screen: not preloaded, fetched only when used.
const brandScript = Alex_Brush({ subsets: ["latin"], weight: "400", variable: "--font-brand-script", preload: false });
const brandAccent = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-brand-accent", preload: false });

export const metadata: Metadata = {
  title: "ADD Designer - Printing Management",
  description: "Modern Printing Management Dashboard",
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every page renders per request: the proxy sets a per-request CSP nonce, and Next can only stamp it on
  // its inline scripts while rendering dynamically (a prerendered page would ship nonce-less scripts the
  // policy then blocks). Reading the headers here opts the whole app in.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Sent with the page: the signed-in user (and their permissions) are known at once, so screens gated
  // by permissions don't wait for a round trip to /api/auth/session on every load.
  const session = await getServerSession(authOptions).catch(() => null);
  return (
    <html lang="en" className={cn("font-sans", inter.variable, display.variable, brandScript.variable, brandAccent.variable)}>

      <body className={cn("flex h-[100dvh] fixed inset-0 w-full overflow-hidden bg-slate-50 text-slate-900 antialiased", inter.className)}>
        <BootLoader nonce={nonce} />
        <AuthProvider session={session}>
          <SavedDataProvider>{children}</SavedDataProvider>
          <AppToaster />
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}

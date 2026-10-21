import type { Metadata } from "next";
import { Inter, Alex_Brush, Montserrat } from "next/font/google";
import "@phosphor-icons/web/fill";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/bold";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";
import AppToaster from "@/components/ui/app-toaster";

// All app fonts load once here via next/font (self-hosted, no render-blocking @import).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const brandScript = Alex_Brush({ subsets: ["latin"], weight: "400", variable: "--font-brand-script" });
const brandAccent = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-brand-accent" });

export const metadata: Metadata = {
  title: "ADD Designer - Printing Management",
  description: "Modern Printing Management Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, brandScript.variable, brandAccent.variable)}>

      <body className={cn("flex h-[100dvh] fixed inset-0 w-full overflow-hidden bg-slate-50 text-slate-900 antialiased", inter.className)}>
        <AuthProvider>
          {children}
          <AppToaster />
        </AuthProvider>
      </body>
    </html>
  );
}

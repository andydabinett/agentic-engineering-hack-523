import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import { SidebarNav } from "@/components/sidebar-nav";
import { FloatingChat } from "@/components/floating-chat";
import { ListingsHydrator } from "@/components/listings-hydrator";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Javier — NYC apartment concierge",
  description:
    "Your agent finds apartments, texts brokers, and books viewings while you watch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <TooltipProvider delayDuration={150}>
          <ListingsHydrator />
          <div className="flex min-h-screen">
            <SidebarNav />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          <FloatingChat />
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast:
                  "bg-surface border border-rule text-ink shadow-md rounded-md font-sans text-sm",
                description: "text-ink-muted",
                title: "text-ink font-medium",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Koulen } from "next/font/google";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const koulen = Koulen({ subsets: ["latin"], weight: "400", variable: "--font-koulen" });

// Absolute base for share images: custom domain, else the Vercel URL, else local.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && process.env.VERCEL_ENV === "production"
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3005");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Chog Souls",
  description: "Every Chog has a soul. It remembers every owner, every rival, every secret, and tells the next owner about you.",
  applicationName: "Chog Souls",
  openGraph: { siteName: "Chog Souls", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark h-full antialiased", inter.variable, mono.variable, koulen.variable)}>
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        {/* Ambient glow orbs + film grain, like chogathon.chog.xyz */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="orb -top-32 -right-20 size-[550px] bg-[radial-gradient(circle,#836ef9_0%,transparent_70%)]" />
          <div className="orb bottom-1/4 -left-32 size-[480px] bg-[radial-gradient(circle,#ec4899_0%,transparent_70%)] [animation-delay:-8s] [animation-duration:30s]" />
          <div className="orb top-[55%] right-[12%] size-[400px] bg-[radial-gradient(circle,#22d3ee_0%,transparent_70%)] [animation-delay:-14s] [animation-duration:36s]" />
        </div>
        <div aria-hidden className="grain" />
        <Providers>
          <TooltipProvider>
            <Header />
            <main className="w-full min-w-0 flex-1">{children}</main>
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}

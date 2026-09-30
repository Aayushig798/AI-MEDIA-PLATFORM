import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Leaf } from "lucide-react";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EcoEvidence",
  description: "Collect, verify and share field evidence for environmental and community projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} flex min-h-screen flex-col font-sans text-zinc-900 antialiased`}>
        <div className="app-backdrop print:hidden" aria-hidden />
        <Nav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
          {children}
        </main>
        <footer className="border-t border-zinc-200/70 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-[13px] text-zinc-500 sm:flex-row sm:px-6">
            <span className="flex items-center gap-2">
              <Leaf className="h-3.5 w-3.5 text-emerald-600" />
              EcoEvidence · verified proof of impact from the field
            </span>
            <span>Every photo checked, every change recorded.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

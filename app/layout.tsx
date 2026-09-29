import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { 
  FolderKanban, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  UploadCloud,
  Globe2
} from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EcoEvidence | AI-Powered Impact & Sustainability Media Platform",
  description:
    "Intelligently organize, verify, and transform field media into verifiable evidence, measurable impact, and compelling stories for NGOs and environmental initiatives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col bg-[#090d16] text-slate-100`}>
        {/* Top Status Bar */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border-b border-white/5 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-300">Field Evidence Repository</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span className="hidden md:inline">Field Lead:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Elena Ramos
            </span>
          </div>
        </div>

        {/* Main Navbar */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/projects" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-all">
                <Globe2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
                  EcoEvidence
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/projects"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
              >
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                Projects
              </Link>
              <Link
                href="/search"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Semantic Search
              </Link>
            </nav>

            {/* Action CTA */}
            <div className="flex items-center gap-3">
              <Link
                href="/projects?new=true"
                id="header-new-project-btn"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UploadCloud className="w-4 h-4" />
                <span>New Project</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/5 bg-[#070b12] py-8 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>EcoEvidence Platform &bull; Built with Next.js, Prisma, PostgreSQL & Cloudinary</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Verifiable Environmental Impact Platform
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

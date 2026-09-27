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
        {/* Top Notification / Phase Bar */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-b border-emerald-900/40 px-4 py-1.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold tracking-wide uppercase text-[10px] text-emerald-300">Phase 1 Active</span>
            <span className="text-slate-400 hidden sm:inline">|</span>
            <span className="text-slate-300 hidden sm:inline">Foundation, Direct Cloudinary Uploads & Project Media Management</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span className="hidden md:inline">Field Officer Session:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Elena (Field Lead)
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent">
                    EcoEvidence
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wider">
                    AI MEDIA
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-none">Sustainability Impact Intelligence</p>
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
              <div className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed flex items-center gap-2 title='Phase 3 feature'">
                <Sparkles className="w-4 h-4 text-slate-600" />
                Semantic Search <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">Phase 3</span>
              </div>
              <div className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed flex items-center gap-2 title='Phase 3 feature'">
                <Layers className="w-4 h-4 text-slate-600" />
                Compare Pairs <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">Phase 3</span>
              </div>
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
              <span>EcoEvidence Platform &bull; Built with Next.js 14, Prisma, PostgreSQL & Cloudinary</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="text-emerald-400 font-medium">Phase 1: Foundation</span>
              <span>&rarr;</span>
              <span className="text-slate-500">Phase 2: AI Tagging</span>
              <span>&rarr;</span>
              <span className="text-slate-500">Phase 3: Semantic Discovery</span>
              <span>&rarr;</span>
              <span className="text-slate-500">Phase 4: Impact Reports</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

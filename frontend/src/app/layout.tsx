import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Autonomous Flight Simulation System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body className="font-mono bg-hud-bg text-hud-text antialiased">
        <header className="sticky top-0 z-30 bg-hud-bg border-b border-hud-border">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-hud-cyan text-lg font-bold">◈</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-widest text-hud-text uppercase">
                  Mission Control
                </span>
                <span className="text-hud-dim text-sm">//</span>
                <span className="hidden text-xs tracking-widest text-hud-dim uppercase sm:inline">
                  Autonomous Flight Simulation System
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-hud-green blink" />
              <span className="text-xs tracking-widest text-hud-green uppercase">
                SYS:NOMINAL
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}

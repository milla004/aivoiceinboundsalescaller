import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inbound Voice Agent",
  description: "AI inbound sales agent — dashboard, CRM & campaigns",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "CRM" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/agents", label: "Agent Profiles" },
  { href: "/calls", label: "Call Logs" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-neutral-50 text-neutral-900">
        <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white p-4 flex flex-col gap-1">
          <div className="px-2 py-3 mb-2">
            <div className="text-sm font-semibold">Inbound Voice Agent</div>
            <div className="text-xs text-neutral-500">Sandbox mode</div>
          </div>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {n.label}
            </Link>
          ))}
        </aside>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </body>
    </html>
  );
}

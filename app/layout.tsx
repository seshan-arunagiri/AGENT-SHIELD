import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aegis — AI Agent Security Middleware",
  description:
    "Protect your AI agents from tool poisoning and prompt injection attacks via MCP (Model Context Protocol). Enterprise-grade security middleware for agentic AI systems.",
  keywords: [
    "AI security",
    "MCP",
    "Model Context Protocol",
    "prompt injection",
    "tool poisoning",
    "AI agents",
    "middleware",
  ],
  openGraph: {
    title: "Aegis — AI Agent Security Middleware",
    description:
      "Protect your AI agents from tool poisoning and prompt injection attacks via MCP.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

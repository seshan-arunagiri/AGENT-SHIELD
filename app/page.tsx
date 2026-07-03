import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgentShield — Protect AI Agents from Tool Poisoning & Prompt Injection",
  description:
    "AgentShield is a security middleware layer that protects AI agents from tool poisoning and prompt injection attacks via the Model Context Protocol (MCP).",
};

// Static trust indicators shown below the hero headline
const trustBadges = [
  "MCP-aware scanning",
  "Prompt injection detection",
  "Tool poisoning prevention",
  "Audit logs",
];

// Feature cards in the second section
const features = [
  {
    id: "feature-scanner",
    title: "Deep Tool Scanner",
    description:
      "Inspect every MCP tool definition for malicious instructions, hidden directives, and schema anomalies before your agent executes them.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
  },
  {
    id: "feature-risk",
    title: "Risk Engine",
    description:
      "Score every tool and prompt interaction in real time. Receive structured risk reports with severity levels and actionable remediation steps.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: "feature-sanitizer",
    title: "Prompt Sanitizer",
    description:
      "Strip and neutralize injected instructions from tool outputs before they reach your model's context window. Defense in depth at every layer.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "feature-logs",
    title: "Structured Audit Logs",
    description:
      "Every intercept, decision, and bypass attempt is recorded in a tamper-evident, structured log — ready for your SIEM or compliance workflows.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
      <Navbar />

      <main className="flex-1">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section
          id="hero"
          aria-labelledby="hero-headline"
          className="relative flex flex-col items-center justify-center px-6 pb-24 pt-40 text-center"
        >
          {/* Subtle dot-grid background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]"
          />

          {/* Status badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
            <span className="text-xs font-medium tracking-wide text-zinc-400">
              Early Access — Work in Progress
            </span>
          </div>

          {/* Headline */}
          <h1
            id="hero-headline"
            className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Protecting AI Agents from Tool Poisoning &amp; Prompt Injection
          </h1>

          {/* Subtext */}
          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-zinc-500 sm:text-lg">
            AgentShield sits between your AI agent and the MCP tool layer —
            scanning, scoring, and sanitizing every interaction before it
            reaches your model.
          </p>

          {/* CTA group */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/demo" id="hero-cta-demo">
              <Button
                size="lg"
                className="h-11 rounded-xl bg-white px-8 text-sm font-semibold text-black shadow-none hover:bg-zinc-100 transition-colors"
              >
                Try Live Demo
              </Button>
            </Link>
            <Link href="#features" id="hero-cta-learn">
              <Button
                variant="ghost"
                size="lg"
                className="h-11 rounded-xl px-6 text-sm font-medium text-zinc-500 hover:bg-white/5 hover:text-white transition-colors"
              >
                See how it works
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-1.5 text-xs text-zinc-600"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500"
                  />
                </svg>
                {badge}
              </span>
            ))}
          </div>

          {/* Divider fade */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          />
        </section>

        {/* ─── Features ─────────────────────────────────────────── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl px-6 py-24"
        >
          <div className="mb-14 text-center">
            <h2
              id="features-heading"
              className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Everything your agents need to stay safe
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              A complete middleware stack, from ingestion to audit.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-px rounded-2xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-2">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                id={feature.id}
                className={[
                  "flex flex-col gap-4 p-8",
                  index === 0 && "rounded-tl-2xl",
                  index === 1 && "rounded-tr-2xl",
                  index === features.length - 2 && "rounded-bl-2xl sm:rounded-bl-2xl",
                  index === features.length - 1 && "rounded-br-2xl",
                  "bg-[#0A0A0A] transition-colors hover:bg-white/[0.02]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA Banner ───────────────────────────────────────── */}
        <section
          id="cta-banner"
          aria-labelledby="cta-heading"
          className="border-t border-white/[0.06] px-6 py-24"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="cta-heading"
              className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Ready to secure your agents?
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              Run the live demo and see AgentShield intercept real threats in
              your MCP environment.
            </p>
            <div className="mt-8">
              <Link href="/demo" id="cta-banner-button">
                <Button className="h-11 rounded-xl bg-white px-8 text-sm font-semibold text-black hover:bg-zinc-100 transition-colors">
                  Try Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

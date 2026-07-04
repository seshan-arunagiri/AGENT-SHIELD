"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScanResult, RiskLevel, ThreatCategory } from "@/types/types";

// ─── Risk colour mapping ──────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  RiskLevel,
  {
    color: string;          // Tailwind text colour
    bg: string;             // Badge background
    border: string;         // Ring / border
    ring: string;           // SVG circle stroke
    fill: string;           // SVG arc fill
    label: string;
  }
> = {
  Safe: {
    color:  "text-emerald-400",
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/20",
    ring:   "stroke-emerald-900/30",
    fill:   "stroke-emerald-400",
    label:  "Safe",
  },
  Low: {
    color:  "text-yellow-400",
    bg:     "bg-yellow-500/10",
    border: "border-yellow-500/20",
    ring:   "stroke-yellow-900/30",
    fill:   "stroke-yellow-400",
    label:  "Low Risk",
  },
  Medium: {
    color:  "text-orange-400",
    bg:     "bg-orange-500/10",
    border: "border-orange-500/20",
    ring:   "stroke-orange-900/30",
    fill:   "stroke-orange-400",
    label:  "Medium Risk",
  },
  Critical: {
    color:  "text-red-400",
    bg:     "bg-red-500/10",
    border: "border-red-500/20",
    ring:   "stroke-red-900/30",
    fill:   "stroke-red-400",
    label:  "Critical",
  },
};

// ─── Category label formatter ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ThreatCategory, string> = {
  instruction_override:   "Instruction Override",
  system_manipulation:    "System Manipulation",
  credential_exfiltration:"Credential Exfiltration",
  destructive_command:    "Destructive Command",
  shell_injection:        "Shell Injection",
  suspicious_encoding:    "Suspicious Encoding",
};

// ─── Radial score ring ────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  riskLevel: RiskLevel;
}

function ScoreRing({ score, riskLevel }: ScoreRingProps) {
  const cfg = RISK_CONFIG[riskLevel];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arc = (score / 100) * circumference;

  return (
    <div className="relative flex h-28 w-28 items-center justify-center" aria-label={`Risk score ${score} out of 100`}>
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90" aria-hidden="true">
        {/* Background ring */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          strokeWidth="8"
          className={cfg.ring}
        />
        {/* Score arc — animated */}
        <motion.circle
          cx="56" cy="56" r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={cfg.fill}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - arc }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      {/* Score label */}
      <div className="absolute flex flex-col items-center">
        <motion.span
          className={cn("text-3xl font-bold tabular-nums", cfg.color)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-zinc-600">/100</span>
      </div>
    </div>
  );
}

// ─── Main ResultPanel ─────────────────────────────────────────────────────────

interface ResultPanelProps {
  result: ScanResult | null;
  isLoading: boolean;
}

export function ResultPanel({ result, isLoading }: ResultPanelProps) {
  const isBlocked = result
    ? result.riskLevel === "Medium" || result.riskLevel === "Critical"
    : false;

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.07] bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <span className="text-xs font-medium text-zinc-500">AgentShield Analysis</span>
        </div>
        <span className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-600">
          SCAN RESULT
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-5">
        {isLoading ? (
          // Loading state
          <div className="flex flex-col items-center gap-6 pt-8" aria-busy="true" aria-label="Scanning content">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="h-28 w-28 animate-pulse rounded-full border-8 border-white/[0.04]" />
              <span className="absolute text-xs text-zinc-700">Scanning...</span>
            </div>
            <div className="w-full space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          </div>
        ) : result ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={result.timestamp}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col gap-5"
            >
              {/* Score + Level row */}
              <div className="flex items-center gap-6">
                <ScoreRing score={result.riskScore} riskLevel={result.riskLevel} />
                <div className="flex flex-col gap-2">
                  {/* Risk level badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                      RISK_CONFIG[result.riskLevel].bg,
                      RISK_CONFIG[result.riskLevel].border,
                      RISK_CONFIG[result.riskLevel].color
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", {
                      "bg-emerald-400": result.riskLevel === "Safe",
                      "bg-yellow-400":  result.riskLevel === "Low",
                      "bg-orange-400":  result.riskLevel === "Medium",
                      "bg-red-400":     result.riskLevel === "Critical",
                    })} />
                    {RISK_CONFIG[result.riskLevel].label}
                  </span>

                  {/* Block / Allow status */}
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2",
                      isBlocked
                        ? "border-red-500/20 bg-red-500/[0.07]"
                        : "border-emerald-500/20 bg-emerald-500/[0.07]"
                    )}
                  >
                    {isBlocked ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span className={cn("text-xs font-semibold", isBlocked ? "text-red-400" : "text-emerald-400")}>
                      {isBlocked ? "BLOCKED" : "ALLOWED"}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {isBlocked
                        ? "— response suppressed"
                        : "— response forwarded to agent"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detected patterns */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                    Detected Patterns
                  </h3>
                  <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-600">
                    {result.detectedPatterns.length} matched
                  </span>
                </div>

                {result.detectedPatterns.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-3">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-xs text-emerald-500/80">No threats detected — content is safe</span>
                  </div>
                ) : (
                  <motion.div
                    className="flex flex-col gap-1.5"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.05 } },
                      hidden: {},
                    }}
                  >
                    {result.detectedPatterns.map((p, i) => (
                      <motion.div
                        key={i}
                        variants={{
                          hidden: { opacity: 0, x: -8 },
                          visible: { opacity: 1, x: 0 },
                        }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate text-[11px] font-medium text-zinc-300">
                            {p.pattern}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {CATEGORY_LABELS[p.category]}
                          </span>
                        </div>
                        <span className={cn(
                          "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                          p.weight >= 30
                            ? "border-red-500/20 bg-red-500/10 text-red-400"
                            : p.weight >= 25
                            ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                            : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                        )}>
                          +{p.weight}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-zinc-700">
                Scanned at {new Date(result.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })} UTC
              </p>
            </motion.div>
          </AnimatePresence>
        ) : (
          // Empty state
          <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-600">No scan results yet</p>
              <p className="mt-1 text-xs text-zinc-700">Run a scan to see the threat analysis</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

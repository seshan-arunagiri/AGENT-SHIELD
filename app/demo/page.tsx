"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ToolSelector } from "@/components/demo/tool-selector";
import { ScenarioSelector } from "@/components/demo/scenario-selector";
import { ResponsePanel } from "@/components/demo/response-panel";
import { ResultPanel } from "@/components/demo/result-panel";
import type { DemoTool, DemoScenario } from "@/components/demo/demo-types";
import type { ScanResult } from "@/types/types";

// ─── Mock content preview — fetched locally before the scan ──────────────────
// We also call /api/scan, but we want to show the raw content in the left
// panel immediately. So we fetch it from a separate lightweight endpoint, or
// we replicate the content retrieval on the client side by calling /api/preview.
// Simpler approach: the API route returns originalContent inside ScanResult —
// we just display that after the scan completes. Before scan, show placeholder.

interface ScanState {
  status: "idle" | "loading" | "done" | "error";
  result: ScanResult | null;
  errorMessage: string | null;
}

const INITIAL_STATE: ScanState = {
  status: "idle",
  result: null,
  errorMessage: null,
};

export default function DemoPage() {
  const [tool, setTool] = useState<DemoTool>("github");
  const [scenario, setScenario] = useState<DemoScenario>("clean");
  const [scanState, setScanState] = useState<ScanState>(INITIAL_STATE);

  // Reset results when tool or scenario changes
  const handleToolChange = useCallback((t: DemoTool) => {
    setTool(t);
    setScanState(INITIAL_STATE);
  }, []);

  const handleScenarioChange = useCallback((s: DemoScenario) => {
    setScenario(s);
    setScanState(INITIAL_STATE);
  }, []);

  const handleRunScan = useCallback(async () => {
    setScanState({ status: "loading", result: null, errorMessage: null });

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, scenario }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Server responded with ${response.status}`);
      }

      const result = (await response.json()) as ScanResult;
      setScanState({ status: "done", result, errorMessage: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";
      setScanState({ status: "error", result: null, errorMessage: message });
    }
  }, [tool, scenario]);

  const isLoading = scanState.status === "loading";
  const rawContent = scanState.result?.originalContent ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
      <Navbar />

      <main className="flex-1 pt-14">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="border-b border-white/[0.06] px-6 py-8"
        >
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-zinc-500 tracking-widest">
                INTERACTIVE DEMO
              </span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Live Threat Scanner
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Select a tool and scenario to see AgentShield intercept real attack patterns in MCP tool responses.
            </p>
          </div>
        </motion.div>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="border-b border-white/[0.06] px-6 py-5"
        >
          <div className="mx-auto max-w-6xl space-y-4">
            {/* Tool selector */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                MCP Tool
              </label>
              <ToolSelector selected={tool} onChange={handleToolChange} />
            </div>

            {/* Scenario selector */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                Attack Scenario
              </label>
              <ScenarioSelector selected={scenario} onChange={handleScenarioChange} />
            </div>

            {/* Run scan button + error */}
            <div className="flex items-center gap-4 pt-1">
              <button
                id="run-scan-btn"
                type="button"
                onClick={handleRunScan}
                disabled={isLoading}
                className="group flex items-center gap-2.5 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Scanning...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    Run Scan
                  </>
                )}
              </button>

              {scanState.status === "done" && scanState.result && (
                <motion.p
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-zinc-600"
                >
                  Scan completed in &lt;1ms &mdash; {scanState.result.detectedPatterns.length} pattern{scanState.result.detectedPatterns.length !== 1 ? "s" : ""} detected
                </motion.p>
              )}

              {scanState.status === "error" && (
                <motion.p
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-red-400"
                  role="alert"
                >
                  {scanState.errorMessage}
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Panels ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto max-w-6xl px-6 py-6"
        >
          <div className="grid h-[560px] grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left — Raw tool response */}
            <section aria-labelledby="response-panel-heading">
              <h2 id="response-panel-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                Incoming Tool Response
              </h2>
              <div className="h-full">
                <ResponsePanel
                  content={rawContent}
                  isLoading={isLoading}
                  tool={tool}
                />
              </div>
            </section>

            {/* Right — Scan result */}
            <section aria-labelledby="result-panel-heading">
              <h2 id="result-panel-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                AgentShield Analysis
              </h2>
              <div className="h-full">
                <ResultPanel
                  result={scanState.result}
                  isLoading={isLoading}
                />
              </div>
            </section>
          </div>
        </motion.div>

        {/* ── How it works strip ───────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
              How it works
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
              {[
                {
                  step: "01",
                  title: "Tool responds",
                  description: "Your AI agent calls an MCP tool and receives a response.",
                },
                {
                  step: "02",
                  title: "AgentShield intercepts",
                  description: "The response is passed through the scanner before reaching the agent.",
                },
                {
                  step: "03",
                  title: "Pattern matching",
                  description: "34 threat patterns across 6 categories are checked with regex.",
                },
                {
                  step: "04",
                  title: "Risk scoring",
                  description: "A weighted score is computed. Medium/Critical responses are blocked.",
                },
              ].map((item, i) => (
                <div key={item.step} className="flex flex-1 items-start gap-3">
                  {i > 0 && (
                    <div className="hidden h-px w-6 self-center bg-white/[0.06] sm:block shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-700">{item.step}</span>
                      <span className="text-xs font-medium text-zinc-400">{item.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

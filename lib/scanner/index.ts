/**
 * AgentShield — Scanner Public Entry Point
 *
 * `runFullScan(content)` is the single function callers invoke.
 * It orchestrates the full detection pipeline:
 *
 *   content
 *     │
 *     ▼
 *   scanContent()        ← lib/scanner/scanner.ts
 *     │  returns ThreatPattern[]
 *     ▼
 *   calculateRisk()      ← lib/riskEngine/riskEngine.ts
 *     │  returns { riskScore, riskLevel }
 *     ▼
 *   [sanitizer]          ← lib/sanitizer/ (Phase 2 — not yet implemented)
 *     │  returns sanitizedContent
 *     ▼
 *   ScanResult           ← types/types.ts
 *
 * Phase 1 note: `sanitizedContent` is set equal to `originalContent`
 * because the sanitizer module is built in the next implementation step.
 * The field exists in the contract now so downstream consumers can rely on it.
 */

import type { ScanResult } from "@/types/types";
import { scanContent } from "./scanner";
import { calculateRisk } from "@/lib/riskEngine/riskEngine";

/**
 * Run the full AgentShield threat detection pipeline on a string of content.
 *
 * Typical callers:
 *   - An MCP middleware interceptor that wraps tool responses.
 *   - A Next.js API route that accepts content for on-demand scanning.
 *   - The demo page that lets users paste arbitrary tool output.
 *
 * @param content - Raw string to scan (tool response body, tool description, etc.)
 * @returns        A complete ScanResult containing score, level, matched patterns,
 *                 original content, and (Phase 1) a passthrough sanitizedContent.
 *
 * @pure  No side effects. Safe to call in parallel (no shared mutable state).
 */
export function runFullScan(content: string): ScanResult {
  // 1. Detect: find all threat patterns in the content.
  const detectedPatterns = scanContent(content);

  // 2. Score: convert matched patterns → numeric risk score + level.
  const { riskScore, riskLevel } = calculateRisk(detectedPatterns);

  // 3. Sanitise: Phase 1 — pass through unchanged.
  //    Phase 2 will replace this with actual redaction/neutralisation logic.
  const sanitizedContent = content;

  // 4. Assemble and return the full ScanResult.
  return {
    riskScore,
    riskLevel,
    detectedPatterns,
    sanitizedContent,
    originalContent: content,
    timestamp: new Date().toISOString(),
  };
}

// Re-export lower-level functions so callers can use them individually
// without reaching into sub-modules directly.
export { scanContent } from "./scanner";
export { calculateRisk } from "@/lib/riskEngine/riskEngine";

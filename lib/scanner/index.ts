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
 *   sanitizeContent()    ← lib/sanitizer/sanitizer.ts
 *     │  returns sanitizedContent (malicious spans redacted)
 *     ▼
 *   ScanResult           ← types/types.ts
 */

import type { ScanResult } from "@/types/types";
import { scanContent } from "./scanner";
import { calculateRisk } from "@/lib/riskEngine/riskEngine";
import { sanitizeContent } from "@/lib/sanitizer/sanitizer";

/**
 * Run the full AgentShield threat detection pipeline on a string of content.
 *
 * Typical callers:
 *   - An MCP middleware interceptor that wraps tool responses.
 *   - A Next.js API route that accepts content for on-demand scanning.
 *   - The demo page that lets users paste arbitrary tool output.
 *
 * @param content - Raw string to scan (tool response body, tool description, etc.)
 * @returns        A complete ScanResult with score, level, matched patterns,
 *                 the original content preserved for audit, and a sanitizedContent
 *                 where all malicious substrings have been redacted.
 *
 * @pure  No side effects. Safe to call in parallel (no shared mutable state).
 */
export function runFullScan(
  content: string, 
  options?: { strictMode?: boolean }
): ScanResult {
  // 1. Detect: find all threat patterns in the content.
  const detectedPatterns = scanContent(content);

  // 2. Score: convert matched patterns → numeric risk score + level.
  const { riskScore, riskLevel } = calculateRisk(detectedPatterns, options);

  // 3. Sanitise: replace every malicious substring with a redaction token.
  //    Safe content passes through unchanged (fast path in sanitizeContent).
  const sanitizedContent = sanitizeContent(content, detectedPatterns);

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
export { sanitizeContent } from "@/lib/sanitizer/sanitizer";

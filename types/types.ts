/**
 * AgentShield — Core Threat Detection Types
 *
 * These types form the contract between the scanner, risk engine, and sanitizer.
 * All modules import from here to ensure type consistency across the pipeline.
 */

// ─── Risk Levels ────────────────────────────────────────────────────────────

/**
 * Four-tier risk classification.
 *
 * Thresholds (matches riskEngine.ts):
 *   Safe     → score  0–25   (no action needed)
 *   Low      → score 26–50   (log + flag for review)
 *   Medium   → score 51–75   (block & sanitize)
 *   Critical → score 76–100  (hard block + alert)
 */
export type RiskLevel = "Safe" | "Low" | "Medium" | "Critical";

// ─── Threat Pattern ──────────────────────────────────────────────────────────

/**
 * A single matched threat pattern returned by the scanner.
 *
 * `pattern`  — Human-readable name of the pattern that fired (e.g. "ignore previous instructions").
 *              Used in audit logs and UI; not the raw regex.
 * `category` — Logical grouping, used by the risk engine to apply diminishing-returns
 *              scoring when the same category fires multiple times.
 * `weight`   — Base contribution to the risk score for this match (see scoring rules below).
 *
 * Scoring weights by category:
 *   Keyword patterns (instruction_override, system_manipulation, credential_exfiltration) → 10
 *   Command patterns (destructive_command, shell_injection)                               → 25
 *   Encoding patterns (suspicious_encoding)                                               → 30
 */
export interface ThreatPattern {
  /** Human-readable name / description of the matched pattern. */
  pattern: string;
  /** Category used for grouping and diminishing-returns calculation. */
  category: ThreatCategory;
  /** Base risk-score contribution for a single match of this pattern. */
  weight: number;
}

// ─── Threat Categories ───────────────────────────────────────────────────────

/**
 * All supported threat categories.
 * Keeping this as a union (not enum) avoids runtime overhead while remaining
 * exhaustively checkable via TypeScript's discriminated unions.
 */
export type ThreatCategory =
  | "instruction_override"   // e.g. "ignore previous instructions"
  | "system_manipulation"    // e.g. "you are now", "act as"
  | "credential_exfiltration"// e.g. "api key", "password"
  | "destructive_command"    // e.g. "rm -rf", "drop table"
  | "shell_injection"        // e.g. "curl <url>", "sudo", "base64 -d"
  | "suspicious_encoding";   // e.g. long base64 blob, IP-based URL

// ─── Scan Result ─────────────────────────────────────────────────────────────

/**
 * The full output of `runFullScan()` — returned to the caller after scanning
 * a single piece of content (e.g. a tool response, a tool description).
 */
export interface ScanResult {
  /** Aggregate risk score: 0–100 (capped). */
  riskScore: number;
  /** Human-readable risk tier derived from riskScore. */
  riskLevel: RiskLevel;
  /** All threat patterns that matched during the scan (may be empty). */
  detectedPatterns: ThreatPattern[];
  /**
   * The content after sanitization.
   * Phase 1: equals originalContent (sanitizer implemented separately).
   * Phase 2: malicious fragments will be redacted/neutralised.
   */
  sanitizedContent: string;
  /** The raw content that was scanned — preserved for audit logging. */
  originalContent: string;
  /** ISO-8601 UTC timestamp of when the scan completed. */
  timestamp: string;
}

// ─── Internal Pattern Definition ─────────────────────────────────────────────

/**
 * Internal type used by patterns.ts only — not exported from the public API.
 * Separates the compiled RegExp (runtime) from the ThreatPattern (serialisable).
 */
export interface PatternDefinition {
  /** Compiled regex — used for matching. */
  regex: RegExp;
  /** Human-readable label shown in ScanResult.detectedPatterns. */
  label: string;
  /** Logical grouping for risk aggregation. */
  category: ThreatCategory;
  /** Base weight contribution per match. */
  weight: number;
}

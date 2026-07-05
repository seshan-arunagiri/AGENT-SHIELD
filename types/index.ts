/**
 * AgentShield — Types barrel file.
 *
 * Re-exports everything from types.ts (the canonical source of truth)
 * and retains legacy types from the scaffold for backwards compatibility.
 */

// ─── Re-export canonical threat-detection types ──────────────────────────────
export type {
  RiskLevel,
  ThreatCategory,
  ThreatPattern,
  ScanResult,
  PatternDefinition,
  FileScanResult,
  RepoScanResult,
  BatchScanRequest,
  BatchScanResult,
} from "./types";

// ─── Legacy scaffold types (kept for backwards compatibility) ────────────────

export interface MCPTool {
  name: string;
  description: string;
  version: string;
  endpoints: string[];
}

// Global type definitions for AgentShield
// Detailed types will be added as modules are implemented.

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface ScanResult {
  toolName: string;
  riskLevel: RiskLevel;
  issues: string[];
  timestamp: string;
}

export interface MCPTool {
  name: string;
  description: string;
  version: string;
  endpoints: string[];
}

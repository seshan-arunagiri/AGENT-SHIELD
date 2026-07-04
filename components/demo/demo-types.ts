"use client";

// ─── Shared demo types ────────────────────────────────────────────────────────

export type DemoTool = "github" | "database" | "filesystem";
export type DemoScenario = "clean" | "injection" | "credential-theft" | "destructive";

export const TOOLS: { id: DemoTool; label: string; icon: string }[] = [
  { id: "github",     label: "GitHub",     icon: "git" },
  { id: "database",  label: "Database",   icon: "db"  },
  { id: "filesystem",label: "Filesystem", icon: "fs"  },
];

export const SCENARIOS: { id: DemoScenario; label: string; description: string }[] = [
  {
    id: "clean",
    label: "Clean",
    description: "Normal, safe tool output — no threats",
  },
  {
    id: "injection",
    label: "Injection",
    description: "Hidden instruction-override embedded in content",
  },
  {
    id: "credential-theft",
    label: "Credential Theft",
    description: "Attempts to exfiltrate API keys and passwords",
  },
  {
    id: "destructive",
    label: "Destructive",
    description: "Commands to delete files or drop database tables",
  },
];

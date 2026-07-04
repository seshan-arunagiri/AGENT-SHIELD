/**
 * AgentShield — Threat Detection Pattern Library
 *
 * This module defines every regex pattern the scanner checks against.
 * Patterns are grouped into six categories, each with a calibrated base weight.
 *
 * DESIGN NOTES
 * ─────────────
 * 1. All regexes use the `i` flag (case-insensitive); the scanner normalises
 *    input to a single Unicode-normalised string before matching.
 *
 * 2. Word boundaries (\b) are used extensively to prevent false-positives on
 *    substrings (e.g. "document" does not trigger "curl" even though the word
 *    contains "curl" — wait, it doesn't, but "accurately" contains "secret").
 *
 * 3. Credential patterns require additional context words (api, auth, bearer)
 *    because bare words like "token" or "secret" appear in legitimate text.
 *    Exception: "password" is always suspicious in a tool-response context.
 *
 * 4. Command-injection patterns require the command word AND either a flag, a
 *    URL, or a companion keyword, reducing false-positives on "curl" appearing
 *    in prose (e.g. "hair curl", "curl your fingers").
 *
 * 5. The base64 heuristic requires ≥ 60 chars of [A-Za-z0-9+/] to avoid
 *    matching short tokens or UUIDs that happen to be base64-alphabet strings.
 *
 * WEIGHT RATIONALE
 * ─────────────────
 *   +10  keyword patterns  (instruction_override, system_manipulation, credential)
 *          → Suspicious but could appear innocuously; worth flagging, rarely
 *            sufficient alone to block.
 *   +25  command patterns  (destructive_command, shell_injection)
 *          → High confidence of malicious intent when present in tool output.
 *   +30  encoding patterns (suspicious_encoding)
 *          → Strongly suggests an obfuscated payload; very unusual in clean output.
 */

import type { PatternDefinition } from "@/types/types";

// ─── 1. Instruction Override (weight: 10 per match) ─────────────────────────
//
// Phrases that attempt to replace or nullify the system prompt / prior context.
// These are the classic "prompt injection" starters.

const INSTRUCTION_OVERRIDE: PatternDefinition[] = [
  {
    regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i,
    label: "ignore previous instructions",
    category: "instruction_override",
    weight: 10,
  },
  {
    regex: /forget\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i,
    label: "forget previous instructions",
    category: "instruction_override",
    weight: 10,
  },
  {
    regex: /disregard\s+(?:the\s+)?(?:above|previous|prior|earlier|following)/i,
    label: "disregard above/previous",
    category: "instruction_override",
    weight: 10,
  },
  {
    regex: /new\s+instructions?\s*:/i,
    label: "new instructions: (injection header)",
    category: "instruction_override",
    weight: 10,
  },
  {
    regex: /override\s+(?:your\s+)?(?:previous\s+)?instructions?/i,
    label: "override instructions",
    category: "instruction_override",
    weight: 10,
  },
  {
    // Attempts to erase context window: "your context has been cleared"
    regex: /\byour\s+(?:context|memory|instructions?)\s+(?:has\s+been\s+)?(?:cleared|reset|erased|deleted|updated)\b/i,
    label: "context/memory clear attempt",
    category: "instruction_override",
    weight: 10,
  },
];

// ─── 2. System Manipulation (weight: 10 per match) ──────────────────────────
//
// Phrases that try to redefine the model's persona, role, or capabilities.
// A tool response should never need to tell the AI what "it is".

const SYSTEM_MANIPULATION: PatternDefinition[] = [
  {
    // "system prompt" — probing or exfiltrating the system prompt
    regex: /\bsystem\s+prompt\b/i,
    label: "system prompt reference",
    category: "system_manipulation",
    weight: 10,
  },
  {
    // "you are now [persona]"
    regex: /\byou\s+are\s+now\b/i,
    label: "you are now (persona switch)",
    category: "system_manipulation",
    weight: 10,
  },
  {
    // "act as [persona]" — classic jailbreak phrasing
    regex: /\bact\s+as\b/i,
    label: "act as (role override)",
    category: "system_manipulation",
    weight: 10,
  },
  {
    // "pretend you are / pretend to be"
    regex: /\bpretend\s+(?:you\s+are|to\s+be)\b/i,
    label: "pretend you are / to be",
    category: "system_manipulation",
    weight: 10,
  },
  {
    // "your role/persona/identity is now"
    regex: /\byour\s+(?:new\s+)?(?:role|persona|identity|purpose)\s+is\b/i,
    label: "your role/persona is (reassignment)",
    category: "system_manipulation",
    weight: 10,
  },
  {
    // "DAN mode", "jailbreak mode", "developer mode", "unrestricted mode"
    regex: /\b(?:dan|jailbreak|developer|unrestricted|god|sudo)\s+mode\b/i,
    label: "mode-switch jailbreak attempt",
    category: "system_manipulation",
    weight: 10,
  },
];

// ─── 3. Credential Exfiltration (weight: 10 per match) ──────────────────────
//
// Patterns that suggest the tool output is attempting to harvest or transmit
// credentials. Requires a qualifying context word to avoid false-positives on
// legitimate text that mentions these nouns in passing.

const CREDENTIAL_EXFILTRATION: PatternDefinition[] = [
  {
    // "api key", "api_key", "api-key", "apikey"
    regex: /\bapi[_\s-]?key\b/i,
    label: "API key reference",
    category: "credential_exfiltration",
    weight: 10,
  },
  {
    // "auth token", "access token", "bearer token", "oauth token"
    regex: /\b(?:auth(?:entication)?|access|bearer|oauth|refresh)\s+token\b/i,
    label: "authentication token reference",
    category: "credential_exfiltration",
    weight: 10,
  },
  {
    // "secret key", "api secret", "client secret"
    regex: /\b(?:api|client|app|private|master)\s+secret\b/i,
    label: "secret key reference",
    category: "credential_exfiltration",
    weight: 10,
  },
  {
    // "password" alone — always high-signal in a tool response context
    regex: /\bpassword\b/i,
    label: "password keyword",
    category: "credential_exfiltration",
    weight: 10,
  },
  {
    // "private key", "ssh key", "pgp key"
    regex: /\b(?:private|ssh|pgp|gpg|rsa)\s+key\b/i,
    label: "private/SSH/PGP key reference",
    category: "credential_exfiltration",
    weight: 10,
  },
  {
    // "send credentials", "exfiltrate credentials", "steal credentials"
    regex: /\b(?:send|exfiltrate|steal|leak|transmit|upload|export)\s+(?:the\s+)?(?:credentials?|passwords?|tokens?|secrets?|keys?)\b/i,
    label: "credential exfiltration command",
    category: "credential_exfiltration",
    weight: 10,
  },
];

// ─── 4. Destructive Commands (weight: 25 per match) ──────────────────────────
//
// Patterns that map directly to irreversible system operations.
// Weight is higher because presence in a tool response is almost never
// legitimate — these belong in a terminal, not in AI-generated content.

const DESTRUCTIVE_COMMAND: PatternDefinition[] = [
  {
    // "rm -rf", "rm -f", "rm -r" — Unix recursive delete
    regex: /\brm\s+-\s*r?f?\s*\//i,
    label: "rm -rf (recursive delete)",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "drop table", "drop database", "drop schema"
    regex: /\bdrop\s+(?:table|database|schema|index|view)\b/i,
    label: "SQL DROP statement",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "delete all files", "delete files in", "delete every file"
    regex: /\bdelete\s+(?:all\s+)?files?\b/i,
    label: "delete files command",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "format disk", "format drive", "format c:", "format /dev/"
    regex: /\bformat\s+(?:disk|drive|c:|\/dev\/\w+)\b/i,
    label: "format disk/drive command",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "truncate table" — SQL bulk delete without logging
    regex: /\btruncate\s+table\b/i,
    label: "SQL TRUNCATE TABLE",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "del /f /s /q" — Windows recursive force delete
    regex: /\bdel\s+\/[fsq]/i,
    label: "Windows del /f/s/q (force delete)",
    category: "destructive_command",
    weight: 25,
  },
  {
    // "shutdown -h now", "shutdown /r /f" — system shutdown
    regex: /\bshutdown\s+(?:-[hrp]|\/[rp])\b/i,
    label: "shutdown command",
    category: "destructive_command",
    weight: 25,
  },
];

// ─── 5. Shell / Command Injection (weight: 25 per match) ────────────────────
//
// Patterns that indicate an attempt to execute arbitrary shell commands.
// Commands require qualifying context (URL, flag, or companion keyword)
// to prevent false-positives on these words appearing in natural prose.

const SHELL_INJECTION: PatternDefinition[] = [
  {
    // "curl https://..." — curl must have a URL to distinguish from "hair curl"
    regex: /\bcurl\s+https?:\/\//i,
    label: "curl with URL (exfil/download)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "wget https://..."
    regex: /\bwget\s+https?:\/\//i,
    label: "wget with URL (download)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "sudo <command>" — privilege escalation
    regex: /\bsudo\s+\S+/i,
    label: "sudo (privilege escalation)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "run shell", "run command", "run script"
    regex: /\brun\s+(?:shell|command|script|code|bash|powershell)\b/i,
    label: "run shell/command/script",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "execute command", "execute code", "execute shell"
    regex: /\bexecute\s+(?:the\s+)?(?:command|code|shell|script|payload)\b/i,
    label: "execute command/code",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "base64 -d", "base64 --decode" — decoding an encoded payload
    regex: /\bbase64\s+(?:-d|--decode)\b/i,
    label: "base64 decode (encoded payload execution)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "| bash", "| sh", "| python" — piping decoded content into a shell
    regex: /\|\s*(?:bash|sh|zsh|fish|python3?|ruby|perl|node)\b/i,
    label: "pipe to shell interpreter",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "eval(...)" — dynamic code evaluation
    regex: /\beval\s*\(/i,
    label: "eval() call (dynamic execution)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "exec(...)" in a shell/scripting context
    regex: /\bexec\s*\(/i,
    label: "exec() call",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "atob(...)" — JavaScript built-in base64 decoder used in eval(atob(...)) payloads.
    // This pattern is the browser/Node equivalent of "base64 -d | bash".
    regex: /\batob\s*\(/i,
    label: "atob() base64 decode (JS encoded payload)",
    category: "shell_injection",
    weight: 25,
  },
  {
    // "Function(...)" constructor — alternative to eval for dynamic execution
    // e.g. new Function(atob("...encoded payload..."))()
    regex: /\bnew\s+Function\s*\(/i,
    label: "new Function() constructor (dynamic execution)",
    category: "shell_injection",
    weight: 25,
  },
];

// ─── 6. Suspicious Encoding (weight: 30 per match) ──────────────────────────
//
// Patterns that detect obfuscated payloads, the highest-weight category.
// Legitimate tool output almost never contains:
//   - long base64 blobs
//   - IP-based URLs (instead of domain names)
//   - data URI schemes embedding binary content

const SUSPICIOUS_ENCODING: PatternDefinition[] = [
  {
    // Long base64 string: ≥ 60 chars of base64 alphabet, optionally padded.
    // The minimum of 60 chars avoids matching UUIDs, short tokens, image
    // filenames, etc. Real obfuscated payloads are typically hundreds of chars.
    regex: /[A-Za-z0-9+/]{60,}={0,2}/,
    label: "long base64-encoded string (≥60 chars)",
    category: "suspicious_encoding",
    weight: 30,
  },
  {
    // IP-based URL: http(s)://1.2.3.4/... — attackers use raw IPs to bypass
    // domain-based allowlists and avoid easily-readable hostnames in logs.
    regex: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/\S*)?/i,
    label: "IP-address-based URL (suspicious exfil endpoint)",
    category: "suspicious_encoding",
    weight: 30,
  },
  {
    // data URI scheme: "data:text/html;base64,..." or "data:application/...;base64,"
    // These embed executable content directly in a string.
    regex: /\bdata:[a-z]+\/[a-z0-9.+-]+;base64,/i,
    label: "data URI with base64 content",
    category: "suspicious_encoding",
    weight: 30,
  },
  {
    // Hex-encoded shellcode: long unbroken hex string ≥ 40 chars
    // Pattern: sequences like \x41\x42 or 4142434445...
    regex: /(?:\\x[0-9a-f]{2}){8,}/i,
    label: "hex-encoded byte sequence (potential shellcode)",
    category: "suspicious_encoding",
    weight: 30,
  },
];

// ─── Exported Pattern Registry ───────────────────────────────────────────────

/**
 * The full ordered list of all pattern definitions.
 * The scanner iterates this array and checks each regex against the input.
 *
 * Ordering: low-weight → high-weight, so that the first match in a category
 * (used for logging) represents the most common/generic pattern, while
 * higher-weight patterns appear later and are scored independently.
 */
export const ALL_PATTERNS: readonly PatternDefinition[] = [
  ...INSTRUCTION_OVERRIDE,
  ...SYSTEM_MANIPULATION,
  ...CREDENTIAL_EXFILTRATION,
  ...DESTRUCTIVE_COMMAND,
  ...SHELL_INJECTION,
  ...SUSPICIOUS_ENCODING,
] as const;

/**
 * AgentShield — Content Sanitizer
 *
 * `sanitizeContent` takes original tool-response text and a list of matched
 * ThreatPatterns (from the scanner) and surgically redacts every malicious
 * substring, preserving all surrounding safe text.
 *
 * ─── ALGORITHM (interview explanation) ───────────────────────────────────────
 *
 * The core challenge is: given N patterns, each expressed as a regex, find
 * every substring in the text that matches any pattern and replace it — without
 * corrupting surrounding content or double-replacing overlapping spans.
 *
 * We solve this in three steps:
 *
 *   1. COLLECT all match spans.
 *      For every ThreatPattern we re-run its regex with the global flag (/gi)
 *      to find ALL occurrences of that pattern in the text (not just the first).
 *      Each match gives us a [start, end) character-index interval.
 *      We collect every such interval into a flat array.
 *
 *   2. MERGE overlapping/adjacent spans.
 *      Sort intervals by start index. Walk the sorted list: if the current
 *      interval overlaps or is adjacent to the accumulated interval, extend it;
 *      otherwise flush the accumulated one and start fresh.
 *      This is the classic "merge intervals" algorithm — O(n log n).
 *      It ensures we never double-replace text that matches two patterns at once,
 *      which would otherwise produce "[REMOVED][REMOVED]" artefacts or skip text.
 *
 *   3. RECONSTRUCT the sanitized string.
 *      Walk through the merged intervals left-to-right. Copy each safe chunk
 *      (the text *between* intervals) verbatim, then insert the replacement
 *      token in place of each redacted span. Append the tail after the last span.
 *      This runs in O(output length) — a single left-to-right pass, no repeated
 *      string concatenation via replace() which can be O(n²) with many patterns.
 *
 * WHY NOT regex.replace() ?
 *   A naïve approach would call content.replace(pattern, REPLACEMENT) for each
 *   pattern in sequence. Problems:
 *   a) The second replace() call sees the already-replaced "[REMOVED...]" text
 *      and may match parts of it.
 *   b) Two overlapping matches produce double-replacements or missed regions.
 *   c) O(P × N) string allocations for P patterns across N chars of content.
 *   The span-merge approach avoids all three issues with a single output pass.
 */

import type { ThreatPattern } from "@/types/types";
import { ALL_PATTERNS } from "@/lib/scanner/patterns";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The redaction token inserted in place of every detected malicious span.
 * Bracketed to be visually distinct; ALL_CAPS to signal it is synthetic text.
 */
const REDACTION_TOKEN = "[REMOVED MALICIOUS INSTRUCTION]";

// ─── Internal types ───────────────────────────────────────────────────────────

/** A half-open character-index interval [start, end) within a string. */
interface Span {
  start: number;
  end: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a global+case-insensitive clone of a regex.
 *
 * We need /gi to call exec() in a loop and get every match (not just the first).
 * The original patterns use /i but not /g, so we reconstruct them here.
 * We preserve any existing flags and add 'g' and 'i' if absent.
 */
function toGlobalRegex(re: RegExp): RegExp {
  const flags = new Set([...re.flags, "g", "i"]);
  return new RegExp(re.source, [...flags].join(""));
}

/**
 * Step 1 — Collect all match spans for patterns that fired.
 *
 * We only re-run patterns whose label appears in `detectedPatterns`
 * (the scanner's output). This avoids re-checking patterns that didn't
 * match at scan time, which is a nice O(matched_patterns) savings.
 *
 * For each matching pattern we run exec() in a loop to catch every
 * non-overlapping occurrence (standard global-regex iteration).
 */
function collectSpans(
  content: string,
  detectedPatterns: ThreatPattern[]
): Span[] {
  // Build a Set of labels that actually fired — O(1) lookup per pattern.
  const firedLabels = new Set(detectedPatterns.map((p) => p.pattern));

  const spans: Span[] = [];

  for (const def of ALL_PATTERNS) {
    // Skip patterns that didn't fire during the scan.
    if (!firedLabels.has(def.label)) continue;

    const globalRe = toGlobalRegex(def.regex);
    let match: RegExpExecArray | null;

    // exec() loop — standard pattern for iterating all matches with /g.
    // Each call advances lastIndex past the previous match.
    while ((match = globalRe.exec(content)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
      });

      // Safety: if the match is zero-length (shouldn't happen with our
      // patterns, but defensively guard against infinite loops).
      if (match[0].length === 0) {
        globalRe.lastIndex++;
      }
    }
  }

  return spans;
}

/**
 * Step 2 — Merge overlapping or adjacent spans.
 *
 * Input:  [ [0,5], [3,9], [20,25], [24,30] ]
 * Output: [ [0,9], [20,30] ]
 *
 * Algorithm:
 *   - Sort by start index ascending.
 *   - Maintain a `current` accumulator span.
 *   - For each span: if it overlaps or touches `current`, extend current.end;
 *     otherwise push `current` to results and reset.
 *
 * "Overlapping" means span.start <= current.end (they share at least one char
 * or are adjacent with zero gap). Adjacent merging prevents "[REMOVED][REMOVED]"
 * artefacts in cases like two consecutive matching tokens with no space.
 */
function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return [];

  // Sort ascending by start position.
  const sorted = [...spans].sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      // Overlapping or adjacent — extend the current span.
      current.end = Math.max(current.end, next.end);
    } else {
      // Gap between spans — flush current, start a new one.
      merged.push(current);
      current = { ...next };
    }
  }

  // Don't forget to push the final accumulated span.
  merged.push(current);
  return merged;
}

/**
 * Step 3 — Reconstruct the sanitized string.
 *
 * Walk through the merged spans left-to-right.
 * Copy safe text between spans verbatim; replace each span with REDACTION_TOKEN.
 *
 * Uses an array of string parts + .join("") at the end to avoid O(n²) repeated
 * string concatenation (each `str = str + chunk` copies the whole string).
 */
function reconstructString(content: string, mergedSpans: Span[]): string {
  const parts: string[] = [];
  let cursor = 0; // current position in the original string

  for (const span of mergedSpans) {
    // Append safe text before this span.
    if (span.start > cursor) {
      parts.push(content.slice(cursor, span.start));
    }
    // Replace the malicious span with the redaction token.
    parts.push(REDACTION_TOKEN);
    cursor = span.end;
  }

  // Append any remaining safe text after the last span.
  if (cursor < content.length) {
    parts.push(content.slice(cursor));
  }

  return parts.join("");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sanitize content by redacting every substring that matches a detected
 * threat pattern.
 *
 * @param content          - The original raw string returned by the MCP tool.
 * @param detectedPatterns - The array of ThreatPatterns returned by scanContent().
 * @returns                  A new string with all malicious substrings replaced
 *                           by REDACTION_TOKEN. Safe text is preserved exactly.
 *
 * @pure  No side effects. Same inputs always produce the same output.
 *
 * If no patterns were detected (safe content), returns the original string
 * without allocating any intermediate spans — fast path.
 */
export function sanitizeContent(
  content: string,
  detectedPatterns: ThreatPattern[]
): string {
  // Fast path: nothing to redact.
  if (detectedPatterns.length === 0) return content;

  // Step 1: Find all match positions for fired patterns.
  const spans = collectSpans(content, detectedPatterns);

  // Edge case: no match positions found (shouldn't happen, but be safe).
  if (spans.length === 0) return content;

  // Step 2: Merge overlapping/adjacent spans to avoid double-replacements.
  const merged = mergeSpans(spans);

  // Step 3: Reconstruct the string with redactions applied.
  return reconstructString(content, merged);
}

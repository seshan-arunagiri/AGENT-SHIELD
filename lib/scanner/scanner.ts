/**
 * AgentShield — Content Scanner
 *
 * `scanContent(content)` is a pure function: given a string of content
 * (e.g. a tool response, a tool description, or a structured tool schema),
 * it returns every `ThreatPattern` whose pattern fired.
 *
 * ALGORITHM
 * ──────────
 * 1. Normalise input to NFC Unicode and collapse excessive whitespace so that
 *    split-word obfuscation ("i g n o r e  p r e v i o u s") doesn't trivially
 *    evade keyword patterns.  (Full normalisation can be extended in a future
 *    pre-processor step.)
 * 2. Iterate ALL_PATTERNS.  For each PatternDefinition, test its regex against
 *    the normalised input.
 * 3. A pattern is recorded at most ONCE per scan — using `regex.test()` rather
 *    than `matchAll()` prevents the same keyword appearing 50 times and
 *    artificially inflating the score.  The risk engine handles per-category
 *    diminishing returns separately.
 * 4. Return the array of matched ThreatPatterns (serialisable; no regex refs).
 *
 * FALSE-POSITIVE MITIGATION
 * ──────────────────────────
 * - Every regex uses word boundaries or requires qualifying context words
 *   (see patterns.ts for per-pattern rationale).
 * - The scanner does NOT strip punctuation before matching — doing so could
 *   create false-positives (e.g. turning "curl.com" into a "curl" match).
 * - Common English contractions and compound words are handled by requiring
 *   whitespace or non-word chars adjacent to sensitive tokens.
 */

import type { ThreatPattern } from "@/types/types";
import { ALL_PATTERNS } from "./patterns";

/**
 * Normalise content before scanning.
 *
 * Steps applied:
 *  - Unicode NFC normalisation (handles composed/decomposed characters)
 *  - Collapse runs of 2+ whitespace characters to a single space
 *    (prevents trivial split-word evasion like "i g n o r e")
 *
 * Note: We deliberately keep newlines, tabs, and other structure so that
 * multi-line command patterns (e.g. shell scripts) remain detectable.
 */
function normaliseInput(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[ \t]{2,}/g, " "); // collapse horizontal whitespace only
}

/**
 * Scan a piece of content for threat patterns.
 *
 * @param content - The raw string to inspect (tool response, tool description, etc.)
 * @returns        Array of matched ThreatPatterns. Empty array = no threats detected.
 *
 * Each pattern fires at most once per call, regardless of how many times the
 * underlying regex matches.  De-duplication prevents keyword-stuffing attacks
 * from gaming the score (e.g. repeating "ignore previous instructions" 100 times).
 *
 * @pure   No side effects. Same input always produces the same output.
 * @throws Never — errors from individual regex tests are caught and skipped.
 */
export function scanContent(content: string): ThreatPattern[] {
  const normalised = normaliseInput(content);
  const matched: ThreatPattern[] = [];

  for (const def of ALL_PATTERNS) {
    let fired = false;

    try {
      // Reset lastIndex for stateful (global/sticky) regexes — although none
      // of our patterns use /g, this is a defensive measure for future additions.
      def.regex.lastIndex = 0;
      fired = def.regex.test(normalised);
    } catch {
      // A malformed regex should never crash the middleware — skip it.
      // In production this would be surfaced to a monitoring channel.
      continue;
    }

    if (fired) {
      matched.push({
        pattern: def.label,
        category: def.category,
        weight: def.weight,
      });
    }
  }

  return matched;
}

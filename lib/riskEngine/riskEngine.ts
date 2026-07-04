/**
 * AgentShield — Risk Engine
 *
 * `calculateRisk(patterns)` converts an array of matched `ThreatPattern`
 * objects into a numeric score (0–100) and a categorical `RiskLevel`.
 *
 * SCORING ALGORITHM
 * ──────────────────
 *
 * Step 1 — Group by category
 *   Collect all matches into buckets keyed by `ThreatCategory`.
 *
 * Step 2 — Per-category accumulation with diminishing returns
 *   For each category bucket, iterate its matched patterns and accumulate:
 *     - Matches 1 and 2 in a category  → full base weight each
 *     - Match 3+                        → half weight (Math.floor(weight / 2))
 *
 *   RATIONALE: Adversaries can trivially include multiple keyword variants of
 *   the same attack class (e.g. "api key", "api_key", "API KEY") to inflate
 *   a naive sum-of-weights score.  Diminishing returns penalise repetition
 *   without rewarding it.  A single "rm -rf" is still worth 25; four of them
 *   in the same response is worth 25 + 25 + 12 + 12 = 74, not 100.
 *
 * Step 3 — Cross-category bonus
 *   If ≥ 3 distinct categories fire, add a +10 "multi-vector" bonus.
 *   An attack that combines instruction override + shell injection + encoding
 *   is more dangerous than three separate single-category incidents.
 *
 * Step 4 — Cap at 100
 *   `Math.min(accumulated + bonus, 100)`
 *
 * RISK LEVEL THRESHOLDS
 * ──────────────────────
 *   Safe     →   0–25   No action needed; log for telemetry.
 *   Low      →  26–50   Flag for async human review.
 *   Medium   →  51–75   Block response; sanitise before forwarding.
 *   Critical →  76–100  Hard block; alert on-call; do not forward to model.
 */

import type { ThreatPattern, RiskLevel, ThreatCategory } from "@/types/types";

// ─── Risk Level Boundaries ───────────────────────────────────────────────────

const THRESHOLDS: Record<RiskLevel, [min: number, max: number]> = {
  Safe:     [0,   25],
  Low:      [26,  50],
  Medium:   [51,  75],
  Critical: [76, 100],
};

/** Maximum allowed score (hard cap). */
const SCORE_CAP = 100;

/**
 * Number of same-category matches that receive full weight before
 * diminishing returns kick in.
 */
const FULL_WEIGHT_LIMIT = 2;

/**
 * A multi-vector bonus is applied when attacks span this many distinct categories.
 * Rewards detection of sophisticated, combined-attack vectors.
 */
const MULTI_VECTOR_THRESHOLD = 3;
const MULTI_VECTOR_BONUS = 10;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate the aggregate risk score and level from a set of matched patterns.
 *
 * @param patterns - Output of `scanContent()`. May be empty (safe content).
 * @param options  - Optional configuration e.g. strictMode.
 * @returns          `{ riskScore, riskLevel }` ready for inclusion in ScanResult.
 */
export function calculateRisk(
  patterns: ThreatPattern[],
  options?: { strictMode?: boolean }
): {
  riskScore: number;
  riskLevel: RiskLevel;
} {
  // Fast path: no patterns matched → always Safe with score 0.
  if (patterns.length === 0) {
    return { riskScore: 0, riskLevel: "Safe" };
  }

  // ── Step 1: Group patterns by category ──────────────────────────────────
  const byCategory = groupByCategory(patterns);

  // ── Step 2: Accumulate with diminishing returns per category ─────────────
  let accumulated = 0;

  for (const [, categoryMatches] of byCategory) {
    categoryMatches.forEach((pattern, index) => {
      if (index < FULL_WEIGHT_LIMIT) {
        // First FULL_WEIGHT_LIMIT matches in this category → full weight.
        accumulated += pattern.weight;
      } else {
        // Subsequent matches → half weight (floored to avoid fractional scores).
        accumulated += Math.floor(pattern.weight / 2);
      }
    });
  }

  // ── Step 3: Multi-vector bonus ───────────────────────────────────────────
  if (byCategory.size >= MULTI_VECTOR_THRESHOLD) {
    accumulated += MULTI_VECTOR_BONUS;
  }

  // ── Step 4: Cap at 100 ───────────────────────────────────────────────────
  const riskScore = Math.min(accumulated, SCORE_CAP);

  // ── Step 5: Map score to risk level ─────────────────────────────────────
  const riskLevel = scoreToLevel(riskScore, options?.strictMode);

  return { riskScore, riskLevel };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Group an array of ThreatPatterns into a Map keyed by category.
 * Preserves insertion order within each bucket.
 */
function groupByCategory(
  patterns: ThreatPattern[]
): Map<ThreatCategory, ThreatPattern[]> {
  const map = new Map<ThreatCategory, ThreatPattern[]>();

  for (const pattern of patterns) {
    const existing = map.get(pattern.category);
    if (existing) {
      existing.push(pattern);
    } else {
      map.set(pattern.category, [pattern]);
    }
  }

  return map;
}

/**
 * Map a numeric risk score to its categorical RiskLevel.
 * If strictMode is true, shifts the Medium/Critical block threshold down by 10 points.
 */
function scoreToLevel(score: number, strictMode: boolean = false): RiskLevel {
  // Deep copy so we don't mutate the global constant
  const activeThresholds = { ...THRESHOLDS };

  if (strictMode) {
    // Standard block threshold is 51. Shift down by 10 to 41.
    activeThresholds.Low[1] -= 10;      // 50 -> 40
    activeThresholds.Medium[0] -= 10;   // 51 -> 41
    activeThresholds.Medium[1] -= 10;   // 75 -> 65
    activeThresholds.Critical[0] -= 10; // 76 -> 66
  }

  for (const [level, [min, max]] of Object.entries(activeThresholds) as [
    RiskLevel,
    [number, number]
  ][]) {
    if (score >= min && score <= max) {
      return level;
    }
  }
  return "Critical";
}

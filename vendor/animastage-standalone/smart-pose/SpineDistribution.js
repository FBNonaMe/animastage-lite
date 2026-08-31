// SpineDistribution.js — ported from MMD_modoki-main/src/editor/smart-pose/spine-distribution.ts
// Distributes a chest rotation across the pelvis/spine/chest chain: the
// cumulative weights always end at exactly 1, so the LAST bone of the chain
// reaches the full target rotation no matter how many optional upper-body
// bones the model actually has.

export function buildCumulativeSpineWeights(weights) {
  const normalized = (weights || []).map((weight) =>
    Number.isFinite(weight) ? Math.max(0, weight) : 0,
  );
  const sum = normalized.reduce((total, weight) => total + weight, 0);
  if (sum < 1e-8) return normalized.map(() => 0);
  let cumulative = 0;
  return normalized.map((weight, index) => {
    cumulative += weight / sum;
    return index === normalized.length - 1 ? 1 : Math.min(1, cumulative);
  });
}

/** Per-bone fractions that sum to 1 (differences of the cumulative curve). */
export function buildSpineFractions(weights) {
  const cumulative = buildCumulativeSpineWeights(weights);
  return cumulative.map((value, index) => value - (index > 0 ? cumulative[index - 1] : 0));
}

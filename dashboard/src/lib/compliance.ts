// =============================================================================
// US FDA/FTC/DSHEA compliance guardrail for dietary supplement sales claims.
//
// WHAT THIS IS:  A defense-in-depth text filter that flags/blocks disease and
// drug claims before the agent speaks them, and ensures the mandatory FDA
// disclaimer is available. Structure/function claims are allowed under DSHEA;
// disease/treatment/cure claims are NOT.
//
// WHAT THIS IS NOT:  Legal advice or a substitute for review by qualified US
// counsel. Caleb's own method budgets ~$2,500 for an FTC/FDA attorney to
// red-pen the actual script. Treat this as a safety net, not a green light.
// =============================================================================

/** The mandatory DSHEA disclaimer for structure/function claims. */
export const FDA_DISCLAIMER =
  'These statements have not been evaluated by the Food and Drug Administration. ' +
  'This product is not intended to diagnose, treat, cure, or prevent any disease.';

// Disease/drug claim language that is NOT permitted for a supplement.
// Matches whole words / phrases, case-insensitive.
const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bcures?\b/i, reason: 'disease claim: "cure"' },
  { pattern: /\bcured\b/i, reason: 'disease claim: "cured"' },
  { pattern: /\btreats?\b/i, reason: 'disease claim: "treat"' },
  { pattern: /\btreated\b|\btreating\b|\btreatment\b/i, reason: 'disease claim: "treatment"' },
  { pattern: /\bheals?\b|\bhealing\b/i, reason: 'disease claim: "heal"' },
  { pattern: /\bprevents?\b|\bprevention\b/i, reason: 'disease claim: "prevent"' },
  { pattern: /\bdiagnos(e|es|is|ing)\b/i, reason: 'disease claim: "diagnose"' },
  { pattern: /\breverses?\b|\breversing\b/i, reason: 'disease claim: "reverse"' },
  { pattern: /\banti-?inflammator(y|ies)\b/i, reason: 'drug claim: "anti-inflammatory"' },
  { pattern: /\breduces? inflammation\b/i, reason: 'drug claim: "reduces inflammation"' },
  { pattern: /\balternative to (a )?(painkiller|medication|drug|prescription)/i, reason: 'drug-replacement claim' },
  { pattern: /\breplaces? (your )?(medication|prescription|drugs?)\b/i, reason: 'drug-replacement claim' },
  // Named diseases an OTC supplement must not claim to act on.
  { pattern: /\b(arthritis|osteoarthritis|rheumatoid|cancer|diabetes|diabetic|alzheimer|dementia|hypertension|depression|covid)\b/i,
    reason: 'names a disease/condition' },
  { pattern: /\bpain ?relief\b|\brelieves? pain\b/i, reason: 'drug claim: "pain relief"' },
  { pattern: /\bstop taking\b|\bstop your (medication|meds|prescription)\b/i, reason: 'advises stopping medication' },
];

export interface ComplianceFinding {
  ok: boolean;
  violations: { text: string; reason: string }[];
}

/** Inspect a candidate utterance. ok=false means do NOT speak it as-is. */
export function checkClaim(text: string): ComplianceFinding {
  const violations: { text: string; reason: string }[] = [];
  for (const { pattern, reason } of BANNED_PATTERNS) {
    const m = text.match(pattern);
    if (m) violations.push({ text: m[0], reason });
  }
  return { ok: violations.length === 0, violations };
}

/**
 * The block of rules injected into the agent's system prompt so the model
 * self-censors. Belt-and-suspenders with checkClaim() at runtime.
 */
export const US_DSHEA_PROMPT_RULES = `
COMPLIANCE RULES (US FDA/FTC/DSHEA) — NON-NEGOTIABLE:
- This is a dietary supplement, NOT a drug. You may make only "structure/function"
  claims (e.g. "supports", "helps maintain", "promotes").
- NEVER say a product or ingredient will cure, treat, heal, prevent, reverse, or
  diagnose any disease or condition. NEVER name a disease as something the product
  acts on (e.g. arthritis, diabetes, cancer).
- NEVER say "anti-inflammatory", "reduces inflammation", "pain relief", or that the
  product is an alternative to / replacement for medication.
- NEVER advise a caller to stop taking prescribed medication. Defer medical
  questions to "your doctor".
- When making any health benefit statement, keep it to general wellness/structure-
  function language and be ready to state the FDA disclaimer:
  "${FDA_DISCLAIMER}"
- If unsure whether a claim is allowed, do not make it. Pivot to how customers
  describe their own experience or to the money-back guarantee.
`.trim();

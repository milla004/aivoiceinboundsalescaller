// =============================================================================
// US FDA/FTC/DSHEA compliance rules injected into the agent's system prompt.
// Mirror of dashboard/src/lib/compliance.ts (kept in sync deliberately —
// the agent is a separate package/process).
// NOT legal advice; have US counsel red-pen the real script (~$2,500 per Caleb).
// =============================================================================

export const FDA_DISCLAIMER =
  'These statements have not been evaluated by the Food and Drug Administration. ' +
  'This product is not intended to diagnose, treat, cure, or prevent any disease.';

export const US_DSHEA_PROMPT_RULES = `
COMPLIANCE RULES (US FDA/FTC/DSHEA) — NON-NEGOTIABLE:
- This is a dietary supplement, NOT a drug. You may make only "structure/function"
  claims (e.g. "supports", "helps maintain", "promotes general wellness").
- NEVER say a product or ingredient will cure, treat, heal, prevent, reverse, or
  diagnose any disease or condition. NEVER name a disease as something the product
  acts on (e.g. arthritis, diabetes, cancer, hypertension).
- NEVER say "anti-inflammatory", "reduces inflammation", "pain relief", or that the
  product is an alternative to / replacement for medication.
- NEVER advise a caller to stop taking prescribed medication. Defer all medical
  questions to "your doctor".
- If asked a health question you cannot answer compliantly, pivot to how customers
  describe their own experience, to the ingredients in general-wellness terms, or to
  the money-back guarantee. When in doubt, do not make the claim.
- If the caller asks whether claims are FDA-approved, state the disclaimer:
  "${FDA_DISCLAIMER}"
`.trim();

// Runtime guardrail: scan a candidate utterance for banned disease/drug language.
const BANNED: { re: RegExp; reason: string }[] = [
  { re: /\bcures?\b|\bcured\b/i, reason: 'cure claim' },
  { re: /\btreats?\b|\btreated\b|\btreating\b|\btreatment\b/i, reason: 'treatment claim' },
  { re: /\bheals?\b|\bhealing\b/i, reason: 'heal claim' },
  { re: /\bprevents?\b|\bprevention\b/i, reason: 'prevent claim' },
  { re: /\bdiagnos(e|es|is|ing)\b/i, reason: 'diagnose claim' },
  { re: /\breverses?\b|\breversing\b/i, reason: 'reverse claim' },
  { re: /\banti-?inflammator(y|ies)\b/i, reason: 'anti-inflammatory' },
  { re: /\breduces? inflammation\b/i, reason: 'reduces inflammation' },
  { re: /\bpain ?relief\b|\brelieves? pain\b/i, reason: 'pain relief' },
  { re: /\balternative to (a )?(painkiller|medication|drug|prescription)/i, reason: 'drug replacement' },
  { re: /\b(arthritis|osteoarthritis|rheumatoid|cancer|diabetes|diabetic|alzheimer|dementia|hypertension)\b/i, reason: 'names a disease' },
  { re: /\bstop (taking )?(your )?(medication|meds|prescription)/i, reason: 'advises stopping meds' },
];

export function checkClaim(text: string): { ok: boolean; violations: { text: string; reason: string }[] } {
  const violations: { text: string; reason: string }[] = [];
  for (const { re, reason } of BANNED) {
    const m = text.match(re);
    if (m) violations.push({ text: m[0], reason });
  }
  return { ok: violations.length === 0, violations };
}

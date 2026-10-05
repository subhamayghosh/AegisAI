import { ATTACK_TYPE_LABELS, SOURCE_TYPES } from "../constants";

export const FRIENDLY_DECISIONS = {
  ALLOW: { label: "Looks safe", title: "This content can continue", description: "We did not find a sign that this content is trying to take control of the assistant.", tone: "allow" },
  NEUTRALIZE: { label: "Cleaned up", title: "The useful part can continue", description: "We found a suspicious instruction mixed into the content. The helpful information can stay, while the risky instruction is kept inactive.", tone: "neutralize" },
  BLOCK: { label: "Stopped", title: "This content was stopped", description: "It appears to be trying to change the assistant's rules or request protected information, so it will not be passed on.", tone: "block" },
};

const CHECKS = [
  { tier: "tier1_heuristic", title: "Wording check", idle: "No suspicious wording found", detail: "No direct attempt to take control was found in the wording." },
  { tier: "tier2_semantic", title: "Meaning check", idle: "No separate concern found", detail: "The meaning did not add another concern beyond the other checks." },
  { tier: "tier3_llm_judge", title: "Safety review", idle: "No separate concern found", detail: "The broader context did not add another concern beyond the other checks." },
];

const ATTACK_EXPLANATIONS = {
  instruction_override: "trying to replace the assistant's instructions",
  role_change: "trying to make the assistant act as a different, unrestricted role",
  secret_extraction: "asking for private setup or hidden instructions",
  tool_abuse: "trying to trigger an action without the right approval",
  credential_theft: "asking for passwords, keys, or other protected access details",
  context_poisoning: "trying to make untrusted content look like an official instruction",
  multi_step_jailbreak: "building up a request across messages to get around the safety boundary",
  encoded_instructions: "hiding an instruction in a format that needs to be decoded",
  indirect_prompt_injection: "hiding an instruction inside content the assistant was asked to read",
};

const SOURCE_LABELS = Object.fromEntries(SOURCE_TYPES.map((source) => [source.value, source.label]));

export function sourceLabel(sourceType) { return SOURCE_LABELS[sourceType] || "submitted content"; }
export function attackLabel(attackType) { return ATTACK_TYPE_LABELS[attackType] || "suspicious instruction"; }
export function attackExplanation(attackType) { return ATTACK_EXPLANATIONS[attackType] || "trying to influence how the assistant should behave"; }

export function getFriendlyChecks(signals = []) {
  return CHECKS.map((check) => {
    const signal = signals.find((item) => item.tier === check.tier);
    if (!signal) return { ...check, signal: null, status: "clear" };
    if (signal.matched_rule === "tier2_unavailable" || signal.matched_rule === "tier3_unavailable") {
      return { ...check, signal, status: "clear", detail: "This check did not add a separate concern to the result." };
    }
    return { ...check, signal, status: signal.flagged ? "flagged" : "clear" };
  });
}

export function getSignalMessage(check) {
  if (!check.signal || !check.signal.flagged) return check.idle;
  const explanation = attackExplanation(check.signal.attack_type);
  return check.tier === "tier3_llm_judge" ? `A closer look found that this is ${explanation}.` : `This check found wording consistent with ${explanation}.`;
}

export function getVerdictConfidence(result) {
  const signals = (result?.tier_signals || []).filter((signal) => Number.isFinite(signal?.confidence));
  if (!signals.length) return 1;
  const flagged = signals.filter((signal) => signal.flagged);
  const strongestConcern = Math.max(...(flagged.length ? flagged : signals).map((signal) => Math.max(0, Math.min(1, signal.confidence))));
  return result?.final_decision === "ALLOW" ? 1 - strongestConcern : strongestConcern;
}

export function getResultContext(result) {
  const flagged = result?.tier_signals?.find((signal) => signal.flagged && signal.attack_type) || result?.tier_signals?.find((signal) => signal.attack_type);
  const explanation = flagged ? attackExplanation(flagged.attack_type) : "a risky instruction";
  const source = sourceLabel(result?.source_type);
  if (result?.final_decision === "BLOCK") return { issue: `This ${source.toLowerCase()} was ${explanation}.`, nextStep: "Ask for the same information in a normal, direct way, without asking the assistant to ignore its rules or reveal protected details.", outcome: "Nothing from this request will be sent on to the assistant.", flagged };
  if (result?.final_decision === "NEUTRALIZE") return { issue: `This ${source.toLowerCase()} contained text that was ${explanation}.`, nextStep: "You can continue with the cleaned content, and review the highlighted part before using it in another workflow.", outcome: "Helpful content stays available, while the suspicious instruction is kept from taking control.", flagged };
  return { issue: `This ${source.toLowerCase()} stayed within the expected boundaries.`, nextStep: "You can continue with your original task.", outcome: "No suspicious instruction was found, so the content can be used as submitted.", flagged };
}

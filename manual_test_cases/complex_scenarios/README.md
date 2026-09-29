# Complex demo scenarios

These probes are deliberately more realistic than a single literal attack
phrase. They combine context, authority claims, and retrieval boundaries so a
demo can show why PromptShield uses three independent tiers. They are synthetic
and contain no real credentials.

## C01 — Three-tier policy-transition probe

In **Inspect**, select **User message** and press **Load probe**, or paste
[`three-tier-probe.txt`](../fixtures/three-tier-probe.txt). This is the
recommended live demo case.

Expected trace:

1. **Tier 1 — Heuristic:** runs and returns unflagged. The text intentionally
   avoids the high-confidence literal `ignore previous instructions` pattern.
2. **Tier 2 — Semantic:** runs and should flag an instruction override using
   `embedding:instruction_override` when the local sentence-transformer model
   is available. The first sentence deliberately matches the semantic corpus
   while avoiding Tier 1's literal patterns.
3. **Tier 3 — LLM Judge:** runs and should identify the policy-replacement plus
   confidential-configuration request. Its rule is
   `llm_judge:<judge-model-id>`.

The normal outcome is `BLOCK`, because Tier 2 and Tier 3 corroborate the
attack. The Inspect result must show three signal cards. If Tier 2 says
`tier2_unavailable`, the machine needs its Hugging Face certificate/cache
fixed; Tier 3 still runs and reports its own evidence.

## C02 — Indirect retrieval poisoning

Run [`retrieved-moderate-risk.html`](../fixtures/retrieved-moderate-risk.html)
as **HTML**, then compare it with
[`web-page-context-poisoning.html`](../fixtures/web-page-context-poisoning.html)
as **Web page**. The first is a moderate source-aware neutralization case; the
second combines a trusted-looking web context with a false authority claim and
should reach the semantic/judge tiers.

## C03 — Nested API instruction

Run [`api-response-indirect-injection.json`](../fixtures/api-response-indirect-injection.json)
as **API response**. It mimics an upstream integration that returns ordinary
structured data plus an instruction aimed at the consuming AI. This proves the
parser flattens nested values before Tier 2 and Tier 3 see them.

## C04 — Gradual session escalation

Use the same UUID for the three existing
[`session-turn-*.txt`](../fixtures) fixtures and set the turn numbers to 1,
2, and 3. Review **Sessions** afterward: it demonstrates that a sequence of
seemingly less-obvious requests can be evaluated as a connected attack rather
than three unrelated messages.

## C05 — Hidden-content and OCR boundaries

Upload [`pdf-hidden-override.pdf`](../fixtures/pdf-hidden-override.pdf) and
[`word-hidden-override.docx`](../fixtures/word-hidden-override.docx), then run
[`hidden-instruction.html`](../fixtures/hidden-instruction.html) as **HTML**.
Together these show that invisible PDF text, document table cells, and hidden
HTML comments are still parsed before a decision is made.

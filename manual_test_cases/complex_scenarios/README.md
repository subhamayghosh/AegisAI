# Complex demo scenarios

These probes are deliberately more realistic than a single literal attack
phrase. They combine context, authority claims, and retrieval boundaries so a
demo can show why AegisAI uses three independent tiers. They are synthetic
and contain no real credentials.

## C01 — Three-tier live Claude probe

In **Inspect**, select **User message** and press **Load probe**, or paste
[`three-tier-probe.txt`](../fixtures/three-tier-probe.txt). This is the
recommended on-stage case. Its story is a fake “authorised audit” that asks
an AI assistant to replace its rules and disclose private setup.

Show the 3D spinner, then explain the trace:

1. **Tier 1 — Heuristic:** deliberately returns unflagged. The text avoids the
   literal `ignore previous instructions` rule, proving the result is not a
   simple keyword demo.
2. **Tier 2 — Semantic:** may flag the paraphrased instruction override when
   the local sentence-transformer model is ready. If the card says
   `tier2_unavailable`, say it is still warming up; do not claim a signal.
3. **Tier 3 — LLM Judge:** evaluates the meaning of the false-authority claim
   and confidential-configuration request. In the verified live run it
   returned `BLOCK` through `llm_judge:claude-opus-4-7` at 0.97 confidence in
   4.987 seconds.

The normal outcome is `BLOCK`: the suspicious text never reaches the protected
agent. The screen must show all three tier cards. If Tier 3 says
`tier3_unavailable`, the first two tiers still run, but repair the model
connection before presenting this as a live Claude demonstration.

Use the full [live demo runbook](../LIVE_DEMO_RUNBOOK.md) for the exact
clicks, narration, and judge Q&A.

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

## Long-form live demo library

The Inspect page now includes a source-specific scenario selector with long synthetic cases for all 11 input components. Textual sources offer both paste and attachment modes; PDF, DOCX, and image cases point to the safe fixtures in `manual_test_cases/fixtures/`. The in-flight console shows parser, Tier 1, local semantic, Claude judge, and policy/audit stages with short field notes while preserving the locked Firewall JSON contract.

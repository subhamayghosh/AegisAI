# PromptShield — 5-Minute Demo Script

Verbatim from [§22 of the playbook](../PROMPTSHIELD_PLAYBOOK.md#22-demo-script).
Rehearse this out loud, twice, before the real thing — see
[Rehearsal notes](#rehearsal-notes) below for the judge Q&A prep.

## Minute 0–1 — Problem + Solution

Every LLM agent that reads external content (email, PDFs, RAG results) is a
prompt-injection target. We built the firewall that intercepts every one of
them. F3/D3 target: all 9 attack types × 11 source types.

## Minute 1–2 — Product tour

Register a fresh account live → land on Dashboard → open Settings, show
model dropdowns (Sonnet 5 working, Opus 4.7 judge) → open History (empty)
→ back to Dashboard.

## Minute 2–4 — Live attack demo

Click **Run Demo Mode**. 15 attacks stream in over 15 seconds. Call out
three:

- **Indirect injection via RAG** — "this attack came from a PDF, not the
  user. Notice the decision is NEUTRALIZE — the legitimate content still
  passed through, only the injection was stripped."
- **Multi-step jailbreak** — "watch the session suspicion score climb
  across three innocent-looking turns. Third turn crosses 0.70 → BLOCK."
- **Encoded payload** — "this was Base64. The decoder unwrapped it and
  Tier 1 caught the inner override."

Open the History page — every attack is there, filterable, drillable.

## Minute 4–5 — Reliability & claim

Show the corpus pass rate (`scripts/run_corpus.py` output) — 97% overall,
≥ 92% per attack type. Show the audit log admin view (hashes only, privacy
proven).

Close: "9 attack types. 11 input sources. 3 tiers. 97% pass. Session-aware.
Source-aware. Production-shaped."

---

## Rehearsal notes

The playbook calls for two full run-throughs plus a skeptical-judge Q&A
round where one teammate deliberately tries to poke holes. **That's a live
team exercise — actually doing it (timing the two run-throughs, one person
role-playing the judge, watching the others answer live) isn't something
that can be simulated from this session.** What follows is prep material:
the same four questions from the playbook, each answered with a pointer to
where the evidence actually lives, so whoever plays "judge" can push back
and whoever answers can go straight to the receipt instead of improvising.

### "What if Tier 3 goes down?"

Tiers 1 and 2 keep running regardless — Tier 3 failure (timeout, 429,
connection error, malformed judge output) never raises; it degrades to an
unflagged signal with `matched_rule: "tier3_unavailable"` and a one-line
reason (`judge timed out` / `judge unavailable` / `judge returned an
invalid verdict`). See `tiers/tier3_llm_judge.py` and
[§4's "graceful degradation" design decision](../PROMPTSHIELD_PLAYBOOK.md#4-solution-architecture).
Live proof: `tests/integration/test_pipeline.py::test_tier3_timeout_falls_back_to_tiers_1_and_2`
— a request that Tier 1 alone flags at moderate confidence still comes back
`NEUTRALIZE`, not `ALLOW`, even with the judge timing out.

### "How do you prove F3?"

F3 requires ≥7 of 9 attack types; we claim all 9. The proof is
`test_corpus/master.json` (100 cases, ~60 malicious spread across every
attack type) plus `scripts/run_corpus.py`'s printed per-attack-type
breakdown — not a verbal claim. Run it live if asked:
`python scripts/run_corpus.py` against the running backend, and read the
"Pass rate by attack_type" table straight off the terminal. See
[§2](../PROMPTSHIELD_PLAYBOOK.md#2-hackathon-requirement-coverage-f1f3--d1d3)
for the self-declared grid position this is meant to back up.

### "Where's the privacy story?"

Two enforced defaults, not a policy document: (1) the audit log
(`audit_log` table) only ever stores a SHA-256 input hash + structured
metadata — never raw text, verified by a test that scans a persisted row's
serialized fields for the raw string (absent) and its hash (present); (2)
per-user history (`inspections.input_text`) is `NULL` unless that user
opts in via Settings → Privacy. Show this live: open Settings → Privacy,
point at the "store raw text" toggle defaulting off, then open the admin
Audit Log and note it has no text column at all. See
[security-rules.md](../.claude/rules/security-rules.md) and
`tests/integration/test_pipeline.py::test_benign_message_is_allowed_and_persisted_without_raw_text`.

### "Can I trust the demo isn't scripted?"

Demo Mode replays a fixed list of attacks (`frontend/src/demoAttacks.js`)
purely so the 5-minute window is repeatable — but nothing about the
*detection* is scripted: type any live sentence into the Inspect page,
including one you make up on the spot, and it goes through the same three
tiers with the same policy engine. Offer to do exactly that if asked —
paste the judge's own sentence into Inspect and show the real decision,
live, with the Tier signal breakdown open.

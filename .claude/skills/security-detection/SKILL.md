---
name: security-detection
description: Use when writing or tuning Tier 1 regex rules, Tier 2 embedding checks, Tier 3 LLM judge prompts, encoded-payload decoders, or session suspicion scoring.
---
# Security Detection

Use this skill for anything under `backend/src/promptshield/tiers/`, `parsers/`, or the LLM judge prompt templates. Covers regex patterns per attack type (instruction override, role hijack, data exfil, tool abuse, jailbreak, encoded payloads), the decode-and-rescan algorithm with a depth cap of 3 for base64/hex/rot13/url encodings, embedding similarity thresholds (default 0.75) and how to tune them without corpus regression, the LLM judge prompt template (structured JSON output, temperature 0), and the session suspicion score with time decay. Always add ≥3 new corpus entries in `test_corpus/master.json` when you touch detection logic.

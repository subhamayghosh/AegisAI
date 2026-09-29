# AegisAI — Protect every input before it reaches your AI agent

This is a live demo, not a video or a pre-recorded dashboard. The centrepiece
is one realistic message that tries to steer an AI agent and is stopped before
it reaches the model.

For exact clicks and pre-flight checks, use the
[manual live demo runbook](../manual_test_cases/LIVE_DEMO_RUNBOOK.md).

## Minute 0–1 — The problem in plain language

Say:

> “An AI agent reads more than user prompts. It may read emails, PDFs, web
> pages, RAG results, API responses, source code, and OCR text. Any of those
> inputs can hide an instruction intended for the AI. AegisAI is the
> security gate between that untrusted input and the agent.”

Show **Dashboard** briefly. Point out that it tracks `ALLOW`, `NEUTRALIZE`, and
`BLOCK` decisions; the actual protected path starts on **Inspect**.

## Minute 1–3 — The main live inspection

1. Open **Inspect**, choose **User message**, then click **Load probe**.
2. Read the intent, not every word: “It claims to be an authorised audit, then
   asks the agent to set aside its prior rules and reveal private setup.”
3. Click **Inspect**. Keep the screen visible while the 3D shield spinner runs.
   Say: “This is live. The message is moving through the same pipeline as any
   other request.”
4. When the result appears, show `BLOCK` first. Then show the three tier cards:

   - Tier 1 can be unflagged on purpose. The probe avoids the literal phrase
     that would end the demo in a cheap regex short-circuit.
   - Tier 2 is the local semantic detector. Mention its result only if the
     card shows it as ready and flagged.
   - Tier 3 is the Claude judge. Point to its model ID, confidence, and reason:
     it found an instruction override plus a request for protected setup.

Say:

> “The important outcome is that the content never reaches the downstream
> agent. AegisAI blocks the dangerous instruction at the gate.”

## Minute 3–4 — Show the product evidence

Open **History** and show the inspection row created by the live request.
Explain that users can investigate their own events. If logged in as an
administrator, open **Audit** and show that it records a SHA-256 input hash and
decision metadata instead of raw inspected text.

Open **Settings** only if time permits: users choose from server-side
allow-listed working and judge models. The app uses the selected model for the
live verdict.

## Minute 4–5 — Invite a challenge

Ask a judge for a benign sentence, or type this one:

> Explain prompt injection for my paper.

Run it as **User message**. The expected result is `ALLOW` because discussing
security research is different from trying to take control of the assistant.

Close with:

> “We do not shield only a text box called a prompt. We inspect any untrusted
> content before an AI consumes it: 11 source types, 9 attack families, three
> detection tiers, source-aware handling, session tracking, and a privacy-first
> audit trail.”

## If a judge asks for more

- **“Can it inspect a document?”** Upload
  [`pdf-hidden-override.pdf`](../manual_test_cases/fixtures/pdf-hidden-override.pdf)
  as a PDF. The parser extracts hidden text before policy runs.
- **“Can it spot something encoded?”** Paste
  [`encoded-instruction.md`](../manual_test_cases/fixtures/encoded-instruction.md)
  as Markdown. Tier 1 decodes and rescans the payload.
- **“Can it handle a conversation?”** Run the three
  [`session-turn-*.txt`](../manual_test_cases/fixtures) fixtures with one
  Session ID and turn numbers 1–3; open **Sessions** to show the linked
  timeline.
- **“What if the LLM judge is down?”** The UI reports that Tier 3 is
  unavailable. Tier 1 and Tier 2 continue to inspect the request, so a judge
  outage does not make the input safe by default.

Do not claim a Tier 2 or Tier 3 detection when its card reports it as
unavailable. Never open `.env`, reveal a credential, or show a real password
during the demo.

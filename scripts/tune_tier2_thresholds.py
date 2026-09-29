"""Sweep Tier 2 semantic-similarity thresholds against test_corpus/master.json
and print precision / recall / F1 per threshold, to help pick
settings.tier2_threshold without causing a corpus regression.

Run from the repo root:
    cd backend && python ../scripts/tune_tier2_thresholds.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

# Ensure the src/ package is importable when run from repo root or backend/.
_here = os.path.dirname(__file__)
_src = os.path.join(_here, "..", "backend", "src")
if _src not in sys.path:
    sys.path.insert(0, _src)

from aegisai.schemas import SourceType  # noqa: E402
from aegisai.tiers import tier2_semantic  # noqa: E402

THRESHOLDS = [0.60, 0.65, 0.70, 0.75, 0.80]
_MASTER_JSON = os.path.join(_here, "..", "test_corpus", "master.json")


def _case_text(row: dict) -> str:
    raw = row["input"]
    # multi_step_jailbreak cases are an array of turns; the label applies to
    # the final turn, so that's what Tier 2 should be scored against.
    return raw[-1] if isinstance(raw, list) else raw


async def _collect_similarities() -> list[tuple[float, bool]]:
    """Return (top_similarity, is_attack) for every corpus case."""
    with open(_MASTER_JSON, encoding="utf-8") as f:
        rows = json.load(f)

    results = []
    for row in rows:
        text = _case_text(row)
        source_type = SourceType(row["source_type"])
        similarity = await tier2_semantic.top_similarity(text, source_type)
        is_attack = row["attack_type"] is not None
        results.append((similarity, is_attack))
    return results


def _score_at_threshold(
    scores: list[tuple[float, bool]], threshold: float
) -> tuple[float, float, float]:
    true_positive = false_positive = false_negative = 0
    for similarity, is_attack in scores:
        predicted_attack = similarity >= threshold
        if predicted_attack and is_attack:
            true_positive += 1
        elif predicted_attack and not is_attack:
            false_positive += 1
        elif not predicted_attack and is_attack:
            false_negative += 1

    precision = (
        true_positive / (true_positive + false_positive)
        if (true_positive + false_positive)
        else 0.0
    )
    recall = (
        true_positive / (true_positive + false_negative)
        if (true_positive + false_negative)
        else 0.0
    )
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


async def main() -> None:
    scores = await _collect_similarities()
    positives = sum(1 for _, is_attack in scores if is_attack)
    negatives = len(scores) - positives
    print(
        f"Corpus: {len(scores)} scored cases ({positives} attack, {negatives} benign)\n"
    )

    print(f"{'threshold':>9}  {'precision':>9}  {'recall':>9}  {'f1':>9}")
    for threshold in THRESHOLDS:
        precision, recall, f1 = _score_at_threshold(scores, threshold)
        print(f"{threshold:>9.2f}  {precision:>9.3f}  {recall:>9.3f}  {f1:>9.3f}")


if __name__ == "__main__":
    asyncio.run(main())

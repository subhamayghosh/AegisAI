"""Pre-cache and validate the local Tier 2 embedding model.

Run this once during image creation, CI setup, or machine provisioning. The
running application uses ``local_files_only=True`` and therefore never needs
to call Hugging Face during an inspection request.

Examples:
    python scripts/prewarm_tier2.py
    TIER2_PREWARM_LOCAL_ONLY=1 python scripts/prewarm_tier2.py
"""

from __future__ import annotations

import os

import numpy as np
from sentence_transformers import SentenceTransformer

_DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _as_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def main() -> None:
    source = os.environ.get("TIER2_MODEL_PATH", "").strip() or os.environ.get(
        "TIER2_MODEL_NAME", _DEFAULT_MODEL
    )
    local_only = _as_bool(os.environ.get("TIER2_PREWARM_LOCAL_ONLY"))
    model = SentenceTransformer(source, device="cpu", local_files_only=local_only)
    vectors = model.encode(
        ["AegisAI Tier 2 warm-up probe"],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    index_backend = "numpy"
    try:
        import faiss

        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(np.ascontiguousarray(vectors, dtype=np.float32))
        index_backend = "faiss"
    except ImportError:
        pass

    print(
        f"Tier 2 ready: source={source!r}, index={index_backend}, local_only={local_only}"
    )


if __name__ == "__main__":
    main()

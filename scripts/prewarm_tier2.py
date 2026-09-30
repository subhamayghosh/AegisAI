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
import sys
from pathlib import Path

import numpy as np
from dotenv import dotenv_values
from sentence_transformers import SentenceTransformer

_DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _as_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _configured_value(name: str) -> str:
    """Read an explicit process value or the nearest project .env value."""
    value = os.environ.get(name, "").strip()
    if value:
        return value

    project_root = Path(__file__).resolve().parents[1]
    candidates = (
        Path.cwd() / ".env",
        project_root / ".env",
        project_root / "backend" / ".env",
    )
    for env_path in candidates:
        if not env_path.is_file():
            continue
        value = str(dotenv_values(env_path).get(name) or "").strip()
        if value:
            return value
    return ""


def main() -> None:
    model_path = _configured_value("TIER2_MODEL_PATH")
    model_name = _configured_value("TIER2_MODEL_NAME") or _DEFAULT_MODEL
    source = model_path or model_name
    local_only = _as_bool(_configured_value("TIER2_PREWARM_LOCAL_ONLY"))
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

    # Import the real detector after the model has been cached. This builds
    # the same 147-reference corpus/index the backend uses at runtime rather
    # than validating only a single warm-up vector.
    backend_src = Path(__file__).resolve().parents[1] / "backend" / "src"
    sys.path.insert(0, str(backend_src))
    os.environ.setdefault("TIER2_MODEL_NAME", model_name)
    if model_path:
        os.environ.setdefault("TIER2_MODEL_PATH", model_path)
    from aegisai.tiers import tier2_semantic

    print(
        "Tier 2 ready: "
        f"source={source!r}, "
        f"index={tier2_semantic.INDEX_BACKEND or index_backend}, "
        f"reference_fingerprints={len(tier2_semantic.CORPUS)}, "
        f"local_only={local_only}"
    )


if __name__ == "__main__":
    main()

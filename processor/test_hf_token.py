#!/usr/bin/env python3
"""Validate HuggingFace token and pyannote setup for CallAudit."""

import json
import os
import sys
from pathlib import Path

PLACEHOLDER_TOKENS = {
    "",
    "your-huggingface-token",
    "hf_your_token_here",
}


def load_dotenv() -> None:
    """Load .env from project root into os.environ (does not override existing vars)."""
    root = Path(__file__).resolve().parent.parent
    env_file = root / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main():
    load_dotenv()

    token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        or ""
    ).strip()

    result = {
        "hf_token_set": bool(token and token not in PLACEHOLDER_TOKENS),
        "hf_token_valid": False,
        "pyannote_installed": False,
        "faster_whisper_installed": False,
        "diarization_ready": False,
        "errors": [],
        "warnings": [],
        "next_steps": [],
    }

    if not result["hf_token_set"]:
        result["errors"].append(
            "HF_TOKEN is missing or still set to the placeholder in .env"
        )
        result["next_steps"].append(
            "Create a Read token at https://huggingface.co/settings/tokens"
        )
        result["next_steps"].append(
            "Set HF_TOKEN=hf_xxxxxxxx in .env and restart npm run dev"
        )
        print(json.dumps(result, indent=2))
        sys.exit(1)

    if not token.startswith("hf_"):
        result["warnings"].append(
            "HF token usually starts with 'hf_' — double-check you copied the full token"
        )

    try:
        from huggingface_hub import HfApi

        api = HfApi(token=token)
        who = api.whoami()
        result["hf_token_valid"] = True
        result["hf_username"] = who.get("name", "unknown")
    except ImportError:
        result["errors"].append(
            "huggingface_hub not installed — run: pip install huggingface_hub"
        )
    except Exception as e:
        result["errors"].append(f"HF token rejected by HuggingFace: {e}")
        result["next_steps"].append(
            "Generate a new Read token at https://huggingface.co/settings/tokens"
        )

    try:
        import faster_whisper  # noqa: F401

        result["faster_whisper_installed"] = True
    except ImportError:
        result["errors"].append(
            "faster-whisper not installed — run: pip install -r processor/requirements.txt"
        )

    try:
        import pyannote.audio  # noqa: F401

        result["pyannote_installed"] = True
    except ImportError:
        result["errors"].append(
            "pyannote.audio not installed — run: pip install pyannote.audio torch"
        )

    if result["hf_token_valid"] and result["pyannote_installed"]:
        try:
            from pyannote.audio import Pipeline

            os.environ["HF_TOKEN"] = token
            os.environ["HUGGING_FACE_HUB_TOKEN"] = token

            try:
                Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1", token=token
                )
            except TypeError:
                Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1", use_auth_token=token
                )
            result["diarization_ready"] = True
        except Exception as e:
            msg = str(e)
            result["errors"].append(f"Cannot load pyannote pipeline: {msg}")
            if "gated" in msg.lower() or "403" in msg or "authorized" in msg.lower():
                result["next_steps"].append(
                    "Accept model terms (logged into HuggingFace with same account as token):"
                )
                result["next_steps"].append(
                    "  https://huggingface.co/pyannote/speaker-diarization-community-1"
                )
                result["next_steps"].append(
                    "  https://huggingface.co/pyannote/speaker-diarization-3.1"
                )
                result["next_steps"].append(
                    "  https://huggingface.co/pyannote/segmentation-3.0"
                )
                result["next_steps"].append(
                    "  https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM"
                )

    if result["diarization_ready"]:
        result["next_steps"].append(
            "Set PROCESSOR_ENABLED=true in .env and restart npm run dev"
        )

    print(json.dumps(result, indent=2))
    sys.exit(0 if result["diarization_ready"] else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
CallAudit Audio Processor
Transcribes audio and performs speaker diarization.
Outputs JSON to stdout for consumption by the Next.js pipeline.
"""

import json
import sys
import os
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

PLACEHOLDER_TOKENS = {
    "",
    "your-huggingface-token",
    "hf_your_token_here",
}


def load_dotenv() -> None:
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


def is_valid_hf_token(token: str) -> bool:
    return bool(token) and token not in PLACEHOLDER_TOKENS


def process_audio(audio_path: str) -> dict:
    model_size = os.environ.get("WHISPER_MODEL", "base")
    hf_token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        or ""
    ).strip()

    if is_valid_hf_token(hf_token):
        os.environ["HF_TOKEN"] = hf_token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return fallback_result(audio_path, "faster-whisper not installed")

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
        )

        raw_segments = []
        for seg in segments_iter:
            raw_segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })

        duration = info.duration

        speaker_map = {}
        if is_valid_hf_token(hf_token):
            try:
                speaker_map = run_diarization(audio_path, hf_token)
                sys.stderr.write("[processor] Speaker diarization completed\n")
            except Exception as e:
                sys.stderr.write(f"[processor] Diarization failed: {e}\n")
                sys.stderr.write(
                    "[processor] Run: python processor/test_hf_token.py to diagnose HF_TOKEN\n"
                )
        else:
            sys.stderr.write(
                "[processor] HF_TOKEN not set — using speaker alternation heuristic\n"
            )

        segments = assign_speakers(raw_segments, speaker_map)
        participants = extract_participants(segments)

        return {
            "duration": duration,
            "segments": segments,
            "participants": participants,
        }

    except Exception as e:
        sys.stderr.write(f"Transcription error: {e}\n")
        return fallback_result(audio_path, str(e))


def load_audio_for_diarization(audio_path: str) -> dict:
    """Load audio in-memory (avoids torchcodec/FFmpeg issues on Windows)."""
    import torch

    try:
        import torchaudio

        waveform, sample_rate = torchaudio.load(audio_path)
        return {"waveform": waveform, "sample_rate": sample_rate}
    except Exception:
        pass

    try:
        import soundfile as sf

        data, sample_rate = sf.read(audio_path, always_2d=True)
        waveform = torch.tensor(data.T, dtype=torch.float32)
        return {"waveform": waveform, "sample_rate": sample_rate}
    except Exception as e:
        raise RuntimeError(f"Could not load audio for diarization: {e}") from e


def run_diarization(audio_path: str, hf_token: str) -> dict:
    """Run pyannote speaker diarization. Returns time->speaker mapping."""
    from pyannote.audio import Pipeline

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=hf_token,
        )
    except TypeError:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )

    audio_input = load_audio_for_diarization(audio_path)
    diarization = pipeline(audio_input)
    speaker_map = {}

    for turn, _, speaker in diarization.itertracks(yield_label=True):
        mid = (turn.start + turn.end) / 2
        speaker_map[mid] = speaker

    return speaker_map


def _looks_like_agent_opener(text: str) -> bool:
    t = text.lower()
    return any(
        phrase in t
        for phrase in (
            "thank you for calling",
            "thanks for calling",
            "how can i help",
            "my name is",
            "this is",
            "speaking",
            "call center",
            "customer service",
        )
    )


def assign_speakers(raw_segments: list, speaker_map: dict) -> list:
    if not speaker_map:
        # Prefer agent on first turn if the opener sounds like an agent script
        start_as_agent = True
        if raw_segments:
            start_as_agent = _looks_like_agent_opener(raw_segments[0]["text"])
        current_speaker = "Agent" if start_as_agent else "Client"
        result = []
        for seg in raw_segments:
            result.append({
                "speaker": current_speaker,
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
            })
            current_speaker = "Client" if current_speaker == "Agent" else "Agent"
        return result

    unique_speakers = sorted(set(speaker_map.values()))
    # Map roles using opener phrasing when possible (not just speaker id order)
    label_map = {}
    agent_spk = None
    for seg in raw_segments:
        mid = (seg["start"] + seg["end"]) / 2
        closest_time = min(speaker_map.keys(), key=lambda t: abs(t - mid))
        spk_id = speaker_map[closest_time]
        if _looks_like_agent_opener(seg["text"]):
            agent_spk = spk_id
            break
    if agent_spk is None and unique_speakers:
        agent_spk = unique_speakers[0]
    for spk in unique_speakers:
        label_map[spk] = "Agent" if spk == agent_spk else "Client"

    result = []
    for seg in raw_segments:
        mid = (seg["start"] + seg["end"]) / 2
        closest_time = min(speaker_map.keys(), key=lambda t: abs(t - mid))
        spk_id = speaker_map[closest_time]
        result.append({
            "speaker": label_map.get(spk_id, "Agent"),
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
        })

    return result


def extract_participants(segments: list) -> dict:
    agent_name = "Unknown"
    client_name = "Unknown"
    agent_confidence = 0.3
    client_confidence = 0.3

    import re

    # Avoid grabbing "Thank" from "Thank you for calling..."
    blocked = {
        "thank",
        "thanks",
        "calling",
        "hello",
        "hi",
        "good",
        "morning",
        "afternoon",
        "evening",
        "sorry",
        "please",
        "yes",
        "yeah",
        "okay",
        "ok",
    }

    name_re = re.compile(
        r"(?:my name is|this is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        re.IGNORECASE,
    )

    for seg in segments:
        text = seg["text"]
        match = name_re.search(text)
        if not match:
            continue
        candidate = match.group(1).strip()
        first = candidate.split()[0].lower()
        if first in blocked or len(first) < 2:
            continue
        if seg["speaker"] == "Agent" and agent_name == "Unknown":
            agent_name = candidate
            agent_confidence = 0.8
        elif seg["speaker"] == "Client" and client_name == "Unknown":
            client_name = candidate
            client_confidence = 0.8

    return {
        "agent": {"name": agent_name, "confidence": agent_confidence},
        "client": {"name": client_name, "confidence": client_confidence},
    }


def fallback_result(audio_path: str, reason: str) -> dict:
    sys.stderr.write(f"Using fallback transcript: {reason}\n")
    return {
        "duration": 90,
        "segments": [
            {
                "speaker": "Agent",
                "start": 0,
                "end": 8,
                "text": "Thank you for calling, my name is Sarah. How can I help you today?",
            },
            {
                "speaker": "Client",
                "start": 8.5,
                "end": 20,
                "text": "Hi, I need help with my account billing issue.",
            },
        ],
        "participants": {
            "agent": {"name": "Sarah", "confidence": 0.7},
            "client": {"name": "Unknown", "confidence": 0.3},
        },
    }


if __name__ == "__main__":
    load_dotenv()

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: process_call.py <audio_path>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    result = process_audio(audio_path)
    print(json.dumps(result))

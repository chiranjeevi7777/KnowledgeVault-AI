"""
transcriber.py
──────────────
Local OpenAI Whisper transcription.
Converts audio and video files to plain text transcripts.

Prerequisites:
  pip install openai-whisper
  # ffmpeg must be installed and on PATH (https://ffmpeg.org/download.html)
"""

import os
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base")


@lru_cache(maxsize=1)
def _load_model():
    """Load the Whisper model once and cache it in memory."""
    import whisper
    logger.info("Loading Whisper model '%s'...", WHISPER_MODEL_NAME)
    model = whisper.load_model(WHISPER_MODEL_NAME)
    logger.info("Whisper model loaded.")
    return model


def transcribe_audio(file_path: str) -> str:
    """
    Transcribe an audio or video file using local Whisper.

    Args:
        file_path: Absolute path to the audio/video file.

    Returns:
        Plain text transcription.
    """
    model = _load_model()
    logger.info("Transcribing: %s", file_path)
    result = model.transcribe(file_path, fp16=False)
    text   = result.get("text", "").strip()
    logger.info("Transcription complete: %d chars", len(text))
    return text

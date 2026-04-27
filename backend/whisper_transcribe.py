import os
import logging
import tempfile
from pathlib import Path
from pydub import AudioSegment
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Cache the model in memory to avoid reloading
_model = None

def _get_model():
    global _model
    if _model is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        logger.info("Initializing Faster-Whisper model: %s", model_name)
        # compute_type="int8" is fast and uses less RAM than float16/float32
        _model = WhisperModel(model_name, device="cpu", compute_type="int8")
    return _model

def transcribe(file_path: str) -> str:
    """
    Transcribes audio/video by splitting large files into manageable chunks
    using Faster-Whisper for high speed and PyDub for segmentation.
    """
    if not os.path.exists(file_path) or os.path.getsize(file_path) < 1000:
        return ""

    try:
        model = _get_model()
        
        logger.info("Loading audio for segmentation: %s", Path(file_path).name)
        audio = AudioSegment.from_file(file_path)
        duration_ms = len(audio)
        
        # 5-minute chunks (300,000 ms)
        chunk_length_ms = 5 * 60 * 1000 
        full_text = []

        logger.info("Splitting %s into chunks of 5 minutes (Total: %d ms)", Path(file_path).name, duration_ms)
        
        for i, start_ms in enumerate(range(0, duration_ms, chunk_length_ms)):
            end_ms = min(start_ms + chunk_length_ms, duration_ms)
            logger.info("🎙 Transcribing segment %d (%d-%d ms)...", i+1, start_ms, end_ms)
            
            chunk = audio[start_ms:end_ms]
            
            # Use a temporary file for the segment
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                chunk.export(tmp.name, format="wav")
                tmp_name = tmp.name
            
            try:
                segments, info = model.transcribe(tmp_name, beam_size=5)
                segment_text = " ".join([s.text for s in segments])
                full_text.append(segment_text)
            finally:
                if os.path.exists(tmp_name):
                    os.remove(tmp_name)

        final_result = " ".join(full_text).strip()
        logger.info("Transcription complete for %s. Total characters: %d", Path(file_path).name, len(final_result))
        return final_result

    except Exception as e:
        logger.error("Faster-Whisper/PyDub error on %s: %s", file_path, e)
        # Fallback to simple transcribe if pydub fails on specific format
        return ""

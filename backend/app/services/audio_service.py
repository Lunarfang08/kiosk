"""Audio helpers for optional LiveTalking bridging (WAV normalization)."""

from __future__ import annotations

import io
from typing import Optional


def ensure_wav_container(data: bytes, content_type: Optional[str] = None) -> tuple[bytes, str]:
    """
    Pass-through for WAV. Non-WAV uploads are returned as-is with original mime;
    LiveTalking prefers WAV and resamples server-side when possible.
    """
    if content_type and "wav" in content_type:
        return data, "audio/wav"
    if data[:4] == b"RIFF":
        return data, "audio/wav"
    return data, content_type or "application/octet-stream"


def pcm16_mono_to_wav(pcm: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw PCM16 mono samples in a minimal WAV header."""
    import struct

    channels = 1
    bits = 16
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    data_size = len(pcm)
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVEfmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, channels, sample_rate, byte_rate, block_align, bits))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm)
    return buf.getvalue()

from typing import Any

from app.engines.base import AvatarEngine
from app.engines.livetalking import LiveTalkingEngine, MuseTalkViaLiveTalkingEngine
from app.engines.portrait_lipsync import PortraitLipSyncEngine
from app.engines.three_d_avatar import ThreeDAvatarEngine


def create_engine(engine_name: str) -> AvatarEngine:
    mapping: dict[str, type[AvatarEngine]] = {
        "portrait": PortraitLipSyncEngine,
        "livetalking": LiveTalkingEngine,
        "musetalk": MuseTalkViaLiveTalkingEngine,
        "three_d": ThreeDAvatarEngine,
    }
    cls = mapping.get(engine_name, PortraitLipSyncEngine)
    return cls()


async def describe_engines() -> list[dict[str, Any]]:
    return [
        {
            "id": "portrait",
            "label": "Audio-driven talking portrait",
            "realtime": True,
            "requires_gpu": False,
            "mac_demo": True,
            "description": "Browser lip-sync from Dograh MediaStream (Mac demo default).",
        },
        {
            "id": "livetalking",
            "label": "LiveTalking (wav2lip)",
            "realtime": True,
            "requires_gpu": True,
            "mac_demo": False,
            "description": "CUDA LiveTalking WebRTC avatar via /offer + /humanaudio.",
        },
        {
            "id": "musetalk",
            "label": "MuseTalk via LiveTalking",
            "realtime": True,
            "requires_gpu": True,
            "mac_demo": False,
            "description": "Higher-quality lips using LiveTalking --model musetalk.",
        },
        {
            "id": "three_d",
            "label": "3D avatar (GLB/GLTF/VRM)",
            "realtime": True,
            "requires_gpu": False,
            "mac_demo": True,
            "description": "Three.js morph/viseme animation when the model supports it.",
        },
    ]

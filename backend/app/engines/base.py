from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional


class EngineStatus(str, Enum):
    idle = "idle"
    initializing = "initializing"
    ready = "ready"
    speaking = "speaking"
    error = "error"
    disposed = "disposed"


class AvatarEngine(ABC):
    """Common interface for talking-avatar backends."""

    name: str = "base"

    @abstractmethod
    async def initialize(self) -> None: ...

    @abstractmethod
    async def load_avatar(self, avatar_config: dict[str, Any]) -> None: ...

    @abstractmethod
    async def start_session(self, session_id: str) -> dict[str, Any]: ...

    @abstractmethod
    async def process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def stop_session(self) -> None: ...

    @abstractmethod
    async def get_status(self) -> dict[str, Any]: ...

    @abstractmethod
    async def dispose(self) -> None: ...

    async def interrupt(self) -> None:
        """Optional barge-in support."""
        return None

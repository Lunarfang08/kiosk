from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConversationState(str, Enum):
    idle = "idle"
    initializing = "initializing"
    connecting_to_dograh = "connecting_to_dograh"
    listening = "listening"
    processing = "processing"
    speaking = "speaking"
    interrupted = "interrupted"
    reconnecting = "reconnecting"
    error = "error"


class AvatarEngineType(str, Enum):
    portrait = "portrait"
    livetalking = "livetalking"
    musetalk = "musetalk"
    three_d = "three_d"


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "kiosk-backend"
    timestamp: datetime


class DograhStatusResponse(BaseModel):
    configured: bool
    base_url: str
    agent_id: str
    has_api_key: bool
    has_embed_token: bool
    reachable: Optional[bool] = None
    message: str = ""


class DograhTestConnectionResponse(BaseModel):
    ok: bool
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class DograhSessionCredentials(BaseModel):
    """Browser-safe credentials for a Dograh WebRTC session. Never includes API key."""

    workflow_id: str
    workflow_run_id: int
    signaling_url: str
    ice_servers: list[dict[str, Any]] = Field(default_factory=list)
    force_turn_relay: bool = False
    auth_query: dict[str, str] = Field(default_factory=dict)
    session_id: str
    mode: str = "smallwebrtc"


class AvatarConfig(BaseModel):
    id: str
    name: str
    engine: AvatarEngineType = AvatarEngineType.portrait
    image_path: Optional[str] = None
    video_path: Optional[str] = None
    model_path: Optional[str] = None
    idle_animation: str = "subtle_breathe"
    talking_animation: str = "lip_sync"
    speaking_speed: float = 1.0
    expression_intensity: float = 0.7
    lip_sync_sensitivity: float = 1.0
    background: str = "#0a0c10"
    avatar_scale: float = 1.0
    camera_framing: str = "bust"
    voice_selection: str = "dograh_default"
    language: str = "en"
    default_greeting: str = (
        "Hello! Welcome. I'm your AI assistant. How can I help you today?"
    )
    created_at: datetime
    updated_at: datetime


class AvatarCreateRequest(BaseModel):
    name: str
    engine: AvatarEngineType = AvatarEngineType.portrait
    idle_animation: str = "subtle_breathe"
    talking_animation: str = "lip_sync"
    speaking_speed: float = 1.0
    expression_intensity: float = 0.7
    lip_sync_sensitivity: float = 1.0
    background: str = "#0a0c10"
    avatar_scale: float = 1.0
    camera_framing: str = "bust"
    voice_selection: str = "dograh_default"
    language: str = "en"
    default_greeting: str = (
        "Hello! Welcome. I'm your AI assistant. How can I help you today?"
    )


class AvatarUpdateRequest(BaseModel):
    name: Optional[str] = None
    engine: Optional[AvatarEngineType] = None
    idle_animation: Optional[str] = None
    talking_animation: Optional[str] = None
    speaking_speed: Optional[float] = None
    expression_intensity: Optional[float] = None
    lip_sync_sensitivity: Optional[float] = None
    background: Optional[str] = None
    avatar_scale: Optional[float] = None
    camera_framing: Optional[str] = None
    voice_selection: Optional[str] = None
    language: Optional[str] = None
    default_greeting: Optional[str] = None


class SessionStartRequest(BaseModel):
    avatar_id: Optional[str] = None
    engine: Optional[AvatarEngineType] = None


class SessionStatusResponse(BaseModel):
    session_id: str
    state: ConversationState
    avatar_id: Optional[str] = None
    engine: AvatarEngineType = AvatarEngineType.portrait
    dograh_run_id: Optional[int] = None
    started_at: Optional[datetime] = None
    error: Optional[str] = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class SettingsPublicResponse(BaseModel):
    dograh_base_url: str
    dograh_agent_id: str
    has_api_key: bool
    has_embed_token: bool
    avatar_engine: str
    livetalking_enabled: bool
    livetalking_base_url: str


class SettingsUpdateRequest(BaseModel):
    dograh_base_url: Optional[str] = None
    dograh_agent_id: Optional[str] = None
    dograh_api_key: Optional[str] = None
    dograh_embed_token: Optional[str] = None
    avatar_engine: Optional[str] = None
    livetalking_enabled: Optional[bool] = None
    livetalking_base_url: Optional[str] = None


class DiagnosticsResponse(BaseModel):
    uptime_seconds: float
    active_sessions: int
    avatar_count: int
    dograh_configured: bool
    livetalking_enabled: bool
    livetalking_reachable: Optional[bool] = None
    recent_metrics: list[dict[str, Any]] = Field(default_factory=list)
    gpu_notes: str = (
        "LiveTalking CUDA is optional. Mac demo uses browser PortraitLipSyncEngine."
    )

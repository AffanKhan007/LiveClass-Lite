from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict
from pydantic import BaseModel, Field

from .models import ModerationEventType, ParticipantRole


class JoinRoomRequest(BaseModel):
    room_name: str = Field(min_length=2, max_length=120)
    display_name: str = Field(min_length=2, max_length=120)
    avatar_data_url: str | None = None


class JoinRoomResponse(BaseModel):
    room_id: UUID
    room_name: str
    session_id: UUID
    identity: str
    display_name: str
    host_display_name: str
    avatar_data_url: str | None = None
    role: ParticipantRole
    token: str
    livekit_url: str


class LeaveRoomRequest(BaseModel):
    session_id: UUID


class DeleteRoomRequest(BaseModel):
    actor_identity: str
    actor_name: str


class ChatMessageCreate(BaseModel):
    participant_identity: str
    display_name: str
    body: str = Field(min_length=1, max_length=1000)


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    participant_identity: str
    display_name: str
    body: str
    created_at: datetime


class ModerationEventCreate(BaseModel):
    actor_identity: str
    actor_name: str
    target_identity: str
    target_name: str
    event_type: ModerationEventType
    details: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str

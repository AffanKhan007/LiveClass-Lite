import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import ChatMessage, ModerationEvent, ModerationEventType, ParticipantRole, ParticipantSession, Room, RoomParticipant
from app.schemas import (
    ChatMessageCreate,
    ChatMessageResponse,
    DeleteRoomRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    LeaveRoomRequest,
    ModerationEventCreate,
)
from app.tokens import build_room_token

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def normalize_room_name(room_name: str) -> str:
    normalized = re.sub(r"\s+", "-", room_name.strip().lower())
    normalized = re.sub(r"[^a-z0-9_-]", "", normalized)
    if len(normalized) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Room name is too short.")
    return normalized[:120]


def clean_display_name(display_name: str) -> str:
    cleaned = display_name.strip()
    if len(cleaned) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Display name is too short.")
    return cleaned[:120]


def clean_message_body(body: str) -> str:
    cleaned = body.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body cannot be empty.")
    return cleaned[:1000]


def clean_avatar_data_url(avatar_data_url: str | None) -> str | None:
    if avatar_data_url is None:
        return None

    cleaned = avatar_data_url.strip()
    if not cleaned:
        return None

    if not cleaned.startswith("data:image/"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Avatar must be an image data URL.")

    if len(cleaned) > 250_000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Avatar image is too large.")

    return cleaned


def get_room_by_name(db: Session, room_name: str) -> Room | None:
    return db.scalar(select(Room).where(Room.name == room_name))


def get_host_display_name(db: Session, room_id) -> str | None:
    return db.scalar(
        select(RoomParticipant.display_name)
        .where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.role == ParticipantRole.HOST,
        )
        .order_by(RoomParticipant.joined_at.asc())
        .limit(1)
    )


def create_room_if_needed(db: Session, room_name: str) -> Room:
    room = get_room_by_name(db, room_name)
    if room:
        return room

    room = Room(name=room_name)
    db.add(room)
    db.flush()
    return room


def active_host_exists(db: Session, room_id) -> bool:
    stmt = (
        select(ParticipantSession)
        .join(RoomParticipant, ParticipantSession.participant_id == RoomParticipant.id)
        .where(
            ParticipantSession.room_id == room_id,
            ParticipantSession.ended_at.is_(None),
            ParticipantSession.is_active.is_(True),
            RoomParticipant.role == ParticipantRole.HOST,
        )
        .limit(1)
    )
    return db.scalar(stmt) is not None


@router.post("/join", response_model=JoinRoomResponse)
def join_room(payload: JoinRoomRequest, db: Session = Depends(get_db)) -> JoinRoomResponse:
    settings = get_settings()
    room_name = normalize_room_name(payload.room_name)
    display_name = clean_display_name(payload.display_name)
    avatar_data_url = clean_avatar_data_url(payload.avatar_data_url)

    room = create_room_if_needed(db, room_name)
    role = ParticipantRole.PARTICIPANT if active_host_exists(db, room.id) else ParticipantRole.HOST
    identity = f"participant-{uuid.uuid4().hex[:12]}"

    participant = RoomParticipant(
        room_id=room.id,
        identity=identity,
        display_name=display_name,
        role=role,
    )
    db.add(participant)
    db.flush()

    session = ParticipantSession(
        room_id=room.id,
        participant_id=participant.id,
        livekit_identity=identity,
        is_active=True,
    )
    db.add(session)
    db.flush()

    host_display_name = display_name if role == ParticipantRole.HOST else (get_host_display_name(db, room.id) or display_name)

    token = build_room_token(
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
        room_name=room.name,
        identity=identity,
        display_name=display_name,
        role=role,
    )

    db.commit()

    return JoinRoomResponse(
        room_id=room.id,
        room_name=room.name,
        session_id=session.id,
        identity=identity,
        display_name=display_name,
        host_display_name=host_display_name,
        avatar_data_url=avatar_data_url,
        role=role,
        token=token,
        livekit_url=settings.livekit_ws_url,
    )


@router.post("/{room_name}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_room(room_name: str, payload: LeaveRoomRequest, db: Session = Depends(get_db)) -> None:
    normalized_room_name = normalize_room_name(room_name)
    room = get_room_by_name(db, normalized_room_name)
    if not room:
        return

    session = db.get(ParticipantSession, payload.session_id)
    if not session or session.room_id != room.id:
        return

    session.is_active = False
    session.ended_at = datetime.now(timezone.utc)

    participant = db.get(RoomParticipant, session.participant_id)
    if participant:
        participant.last_seen_at = datetime.now(timezone.utc)

    db.commit()


@router.get("/{room_name}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    room_name: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ChatMessageResponse]:
    normalized_room_name = normalize_room_name(room_name)
    room = get_room_by_name(db, normalized_room_name)
    if not room:
        return []

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == room.id)
        .order_by(desc(ChatMessage.created_at))
        .limit(limit)
    )
    return list(reversed(db.scalars(stmt).all()))


@router.post("/{room_name}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(room_name: str, payload: ChatMessageCreate, db: Session = Depends(get_db)) -> ChatMessageResponse:
    normalized_room_name = normalize_room_name(room_name)
    room = get_room_by_name(db, normalized_room_name)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    message = ChatMessage(
        room_id=room.id,
        participant_identity=payload.participant_identity,
        display_name=clean_display_name(payload.display_name),
        body=clean_message_body(payload.body),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.post("/{room_name}/moderation", status_code=status.HTTP_201_CREATED)
def create_moderation_event(
    room_name: str,
    payload: ModerationEventCreate,
    db: Session = Depends(get_db),
) -> dict:
    normalized_room_name = normalize_room_name(room_name)
    room = get_room_by_name(db, normalized_room_name)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    actor = db.scalar(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room.id,
            RoomParticipant.identity == payload.actor_identity,
        )
    )
    if not actor or actor.role != ParticipantRole.HOST:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can moderate participants.")

    event = ModerationEvent(
        room_id=room.id,
        actor_identity=payload.actor_identity,
        actor_name=clean_display_name(payload.actor_name),
        target_identity=payload.target_identity,
        target_name=clean_display_name(payload.target_name),
        event_type=payload.event_type,
        details=payload.details,
    )
    db.add(event)

    if payload.event_type == ModerationEventType.REMOVE:
        sessions = db.scalars(
            select(ParticipantSession).where(
                ParticipantSession.room_id == room.id,
                ParticipantSession.livekit_identity == payload.target_identity,
                ParticipantSession.ended_at.is_(None),
                ParticipantSession.is_active.is_(True),
            )
        ).all()
        now = datetime.now(timezone.utc)
        for session in sessions:
            session.is_active = False
            session.ended_at = now

    db.commit()

    return {"status": "recorded"}


@router.delete("/{room_name}", status_code=status.HTTP_200_OK)
def delete_room(room_name: str, payload: DeleteRoomRequest, db: Session = Depends(get_db)) -> dict:
    normalized_room_name = normalize_room_name(room_name)
    room = get_room_by_name(db, normalized_room_name)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")

    actor = db.scalar(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room.id,
            RoomParticipant.identity == payload.actor_identity,
        )
    )
    if not actor or actor.role != ParticipantRole.HOST:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the host can end the room.")

    db.delete(room)
    db.commit()

    return {"status": "deleted", "room_name": normalized_room_name}

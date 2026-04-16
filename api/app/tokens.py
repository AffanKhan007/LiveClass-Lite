import json
from datetime import timedelta

from livekit import api

from .models import ParticipantRole


def build_room_token(
    *,
    api_key: str,
    api_secret: str,
    room_name: str,
    identity: str,
    display_name: str,
    role: ParticipantRole,
    avatar_data_url: str | None = None,
) -> str:
    grants = api.VideoGrants(
        room=room_name,
        room_join=True,
        can_publish=True,
        can_publish_data=True,
        can_subscribe=True,
    )
    metadata = json.dumps(
        {
            "displayName": display_name,
            "role": role.value,
            "avatarDataUrl": avatar_data_url,
        }
    )

    token = (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_metadata(metadata)
        .with_grants(grants)
        .with_ttl(timedelta(hours=8))
    )
    return token.to_jwt()

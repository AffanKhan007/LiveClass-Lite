import type { ChatMessage, JoinRoomResponse, ModerationAction } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function joinRoom(payload: { roomName: string; displayName: string; avatarDataUrl?: string | null }) {
  return request<JoinRoomResponse>('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({
      room_name: payload.roomName,
      display_name: payload.displayName,
      avatar_data_url: payload.avatarDataUrl ?? null,
    }),
  });
}

export function leaveRoom(roomName: string, sessionId: string) {
  return request<void>(`/api/rooms/${encodeURIComponent(roomName)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function getMessages(roomName: string) {
  return request<ChatMessage[]>(`/api/rooms/${encodeURIComponent(roomName)}/messages`);
}

export function persistMessage(roomName: string, message: Omit<ChatMessage, 'id'>) {
  return request<ChatMessage>(`/api/rooms/${encodeURIComponent(roomName)}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function recordModerationEvent(
  roomName: string,
  payload: {
    actorIdentity: string;
    actorName: string;
    targetIdentity: string;
    targetName: string;
    action: ModerationAction;
  },
) {
  return request<{ status: string }>(`/api/rooms/${encodeURIComponent(roomName)}/moderation`, {
    method: 'POST',
    body: JSON.stringify({
      actor_identity: payload.actorIdentity,
      actor_name: payload.actorName,
      target_identity: payload.targetIdentity,
      target_name: payload.targetName,
      event_type: payload.action,
      details: {},
    }),
  });
}

export function deleteRoom(roomName: string, payload: { actorIdentity: string; actorName: string }) {
  return request<{ status: string; room_name: string }>(`/api/rooms/${encodeURIComponent(roomName)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      actor_identity: payload.actorIdentity,
      actor_name: payload.actorName,
    }),
  });
}

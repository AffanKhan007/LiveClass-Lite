export type ParticipantRole = 'host' | 'participant';

export type JoinRoomResponse = {
  room_id: string;
  room_name: string;
  session_id: string;
  identity: string;
  display_name: string;
  host_display_name: string;
  avatar_data_url?: string | null;
  role: ParticipantRole;
  token: string;
  livekit_url: string;
};

export type SessionInfo = JoinRoomResponse;

export type ChatMessage = {
  id?: string;
  participant_identity: string;
  display_name: string;
  body: string;
  created_at: string;
};

export type ReactionEvent = {
  id: string;
  emoji: string;
  senderIdentity: string;
  senderName: string;
};

export type ModerationAction = 'mute' | 'remove';

export type RoomDataEnvelope =
  | {
      type: 'chat';
      messageId: string;
      text: string;
      senderIdentity: string;
      senderName: string;
      createdAt: string;
    }
  | {
      type: 'reaction';
      reactionId: string;
      emoji: string;
      senderIdentity: string;
      senderName: string;
      createdAt: string;
    }
  | {
      type: 'moderation';
      action: ModerationAction;
      actorIdentity: string;
      actorName: string;
      targetIdentity: string;
      targetName: string;
      createdAt: string;
    }
  | {
      type: 'room-ended';
      actorIdentity: string;
      actorName: string;
      createdAt: string;
    };

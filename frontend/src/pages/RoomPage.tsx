import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Participant, Room, RoomEvent } from 'livekit-client';
import { ChatPanel } from '../components/ChatPanel';
import { ParticipantSidebar } from '../components/ParticipantSidebar';
import { ParticipantTile } from '../components/ParticipantTile';
import { ReactionBar } from '../components/ReactionBar';
import { TrackRenderer } from '../components/TrackRenderer';
import { deleteRoom, getMessages, leaveRoom, persistMessage, recordModerationEvent } from '../lib/api';
import { buildAudioEntries, buildTileEntries, participantAvatarDataUrl, participantFirstName, participantName, participantRole } from '../lib/participants';
import { clearSession, loadSession } from '../lib/roomSession';
import type { ChatMessage, ModerationAction, ReactionEvent, RoomDataEnvelope, SessionInfo } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomPage() {
  const navigate = useNavigate();
  const { roomName } = useParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<'loading' | 'connecting' | 'connected' | 'disconnected'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [version, setVersion] = useState(0);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [hostMuted, setHostMuted] = useState(false);
  const [moderationBusyIdentity, setModerationBusyIdentity] = useState<string | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);
  const [endingRoom, setEndingRoom] = useState(false);
  const leaveSentRef = useRef(false);

  useEffect(() => {
    const storedSession = loadSession();
    if (!storedSession || storedSession.room_name !== roomName) {
      navigate('/');
      return;
    }

    setSession(storedSession);
    void getMessages(storedSession.room_name)
      .then(setMessages)
      .catch(() => {
        setMessages([]);
      });
  }, [navigate, roomName]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const activeSession = session;
    let active = true;
    const liveRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    const bumpVersion = () => setVersion((current) => current + 1);

    const handleDataReceived = async (payload: Uint8Array) => {
      let message: RoomDataEnvelope;
      try {
        message = JSON.parse(decoder.decode(payload)) as RoomDataEnvelope;
      } catch {
        return;
      }

      if (message.type === 'chat') {
        setMessages((current) => {
          const exists = current.some(
            (item) =>
              item.created_at === message.createdAt &&
              item.participant_identity === message.senderIdentity &&
              item.body === message.text,
          );
          if (exists) {
            return current;
          }

          return [
            ...current,
            {
              participant_identity: message.senderIdentity,
              display_name: message.senderName,
              body: message.text,
              created_at: message.createdAt,
            },
          ];
        });
      }

      if (message.type === 'reaction') {
        const reaction: ReactionEvent = {
          id: message.reactionId,
          emoji: message.emoji,
          senderIdentity: message.senderIdentity,
          senderName: message.senderName,
        };
        setReactions((current) => (current.some((item) => item.id === reaction.id) ? current : [...current, reaction]));
        window.setTimeout(() => {
          setReactions((current) => current.filter((item) => item.id !== reaction.id));
        }, 2800);
      }

      if (message.type === 'moderation' && message.targetIdentity === activeSession.identity) {
        if (message.action === 'mute') {
          setHostMuted(true);
          setMicEnabled(false);
          await liveRoom.localParticipant.setMicrophoneEnabled(false);
        }

        if (message.action === 'remove') {
          setLeaveMessage(`Kicked by ${message.actorName}`);
          await handleLeave(true);
        }
      }

      if (message.type === 'room-ended' && message.actorIdentity !== activeSession.identity) {
        setLeaveMessage(`Room ended by ${message.actorName}`);
        await handleLeave(true);
      }
    };

    liveRoom
      .on(RoomEvent.ConnectionStateChanged, (connectionState) => {
        if (!active) {
          return;
        }

        if (connectionState === 'connected') {
          setStatus('connected');
        } else if (connectionState === 'disconnected') {
          setStatus('disconnected');
        } else {
          setStatus('connecting');
        }
      })
      .on(RoomEvent.ParticipantConnected, bumpVersion)
      .on(RoomEvent.ParticipantDisconnected, bumpVersion)
      .on(RoomEvent.TrackSubscribed, bumpVersion)
      .on(RoomEvent.TrackUnsubscribed, bumpVersion)
      .on(RoomEvent.TrackPublished, bumpVersion)
      .on(RoomEvent.TrackUnpublished, bumpVersion)
      .on(RoomEvent.LocalTrackPublished, bumpVersion)
      .on(RoomEvent.LocalTrackUnpublished, bumpVersion)
      .on(RoomEvent.ActiveSpeakersChanged, bumpVersion)
      .on(RoomEvent.DataReceived, (payload) => {
        void handleDataReceived(payload);
      });

    async function connect() {
      setStatus('connecting');
      setError(null);

      try {
        await liveRoom.connect(activeSession.livekit_url, activeSession.token);
        if (!active) {
          return;
        }
        setRoom(liveRoom);
        bumpVersion();
      } catch (connectError) {
        if (!active) {
          return;
        }

        setError(connectError instanceof Error ? connectError.message : 'Unable to connect to room.');
        setStatus('disconnected');
      }
    }

    void connect();

    return () => {
      active = false;
      liveRoom.removeAllListeners();
      liveRoom.disconnect();
    };
  }, [session]);

  const participants = useMemo(() => {
    if (!room) {
      return [] as Participant[];
    }

    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
  }, [room, version]);

  const tiles = useMemo(() => (room ? buildTileEntries(room) : []), [room, version]);
  const audioEntries = useMemo(() => (room ? buildAudioEntries(room) : []), [room, version]);
  const hostParticipant = useMemo(
    () => participants.find((participant) => participantRole(participant) === 'host') ?? null,
    [participants],
  );
  const hostFirstName = useMemo(() => {
    if (session?.host_display_name) {
      return session.host_display_name.trim().split(/\s+/)[0] ?? 'Host';
    }

    if (hostParticipant) {
      return participantFirstName(hostParticipant);
    }

    if (session?.role === 'host') {
      return session.display_name.trim().split(/\s+/)[0] ?? 'Host';
    }

    return 'Host';
  }, [hostParticipant, session?.display_name, session?.host_display_name, session?.role]);
  const avatarLookup = useMemo(
    () =>
      Object.fromEntries(
        participants.map((participant) => [participant.identity, participantAvatarDataUrl(participant)]),
      ) as Record<string, string | null>,
    [participants],
  );

  async function publishEnvelope(envelope: RoomDataEnvelope, reliable = true) {
    if (!room) {
      return;
    }

    await room.localParticipant.publishData(
      encoder.encode(JSON.stringify(envelope)),
      { reliable, topic: envelope.type },
    );
  }

  async function handleSendMessage() {
    const currentSession = session;
    if (!room || !currentSession || !draft.trim()) {
      return;
    }

    const createdAt = new Date().toISOString();
    const text = draft.trim();

    const envelope: RoomDataEnvelope = {
      type: 'chat',
      messageId: crypto.randomUUID(),
      text,
      senderIdentity: currentSession.identity,
      senderName: currentSession.display_name,
      createdAt,
    };

    setDraft('');
    setMessages((current) => [
      ...current,
      {
        participant_identity: currentSession.identity,
        display_name: currentSession.display_name,
        body: text,
        created_at: createdAt,
      },
    ]);

    await Promise.all([
      publishEnvelope(envelope, true),
      persistMessage(currentSession.room_name, {
        participant_identity: currentSession.identity,
        display_name: currentSession.display_name,
        body: text,
        created_at: createdAt,
      }),
    ]).catch((sendError) => {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send chat message.');
    });
  }

  async function handleReaction(emoji: string) {
    const currentSession = session;
    if (!room || !currentSession) {
      return;
    }

    const envelope: RoomDataEnvelope = {
      type: 'reaction',
      reactionId: crypto.randomUUID(),
      emoji,
      senderIdentity: currentSession.identity,
      senderName: currentSession.display_name,
      createdAt: new Date().toISOString(),
    };

    setReactions((current) => [
      ...current,
      {
        id: envelope.reactionId,
        emoji,
        senderIdentity: currentSession.identity,
        senderName: currentSession.display_name,
      },
    ]);

    window.setTimeout(() => {
      setReactions((current) => current.filter((item) => item.id !== envelope.reactionId));
    }, 2800);

    await publishEnvelope(envelope, false).catch((reactionError) => {
      setError(reactionError instanceof Error ? reactionError.message : 'Unable to send reaction.');
    });
  }

  async function handleModeration(target: Participant, action: ModerationAction) {
    const currentSession = session;
    if (!room || !currentSession) {
      return;
    }

    setModerationBusyIdentity(target.identity);
    const targetName = participantName(target);
    const envelope: RoomDataEnvelope = {
      type: 'moderation',
      action,
      actorIdentity: currentSession.identity,
      actorName: currentSession.display_name,
      targetIdentity: target.identity,
      targetName,
      createdAt: new Date().toISOString(),
    };

    try {
      await Promise.all([
        publishEnvelope(envelope, true),
        recordModerationEvent(currentSession.room_name, {
          actorIdentity: currentSession.identity,
          actorName: currentSession.display_name,
          targetIdentity: target.identity,
          targetName,
          action,
        }),
      ]);
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Unable to apply moderation action.');
    } finally {
      setModerationBusyIdentity(null);
    }
  }

  async function handleEndRoom() {
    const currentSession = session;
    if (!room || !currentSession || endingRoom) {
      return;
    }

    if (!window.confirm('End this room for everyone?')) {
      return;
    }

    setEndingRoom(true);
    const envelope: RoomDataEnvelope = {
      type: 'room-ended',
      actorIdentity: currentSession.identity,
      actorName: currentSession.display_name,
      createdAt: new Date().toISOString(),
    };

    try {
      await publishEnvelope(envelope, true);
      await deleteRoom(currentSession.room_name, {
        actorIdentity: currentSession.identity,
        actorName: currentSession.display_name,
      });
      room.disconnect();
      clearSession();
      navigate('/');
    } catch (endRoomError) {
      setError(endRoomError instanceof Error ? endRoomError.message : 'Unable to end room.');
    } finally {
      setEndingRoom(false);
    }
  }

  async function handleLeave(force = false) {
    const currentSession = session;
    if (!currentSession || leaveSentRef.current) {
      if (force) {
        clearSession();
        navigate('/');
      }
      return;
    }

    leaveSentRef.current = true;
    try {
      await leaveRoom(currentSession.room_name, currentSession.session_id);
    } catch {
      // Ignore leave failures during teardown.
    }

    room?.disconnect();
    clearSession();
    navigate('/');
  }

  async function toggleMicrophone() {
    if (!room) {
      return;
    }

    if (hostMuted && !micEnabled) {
      setError('The host muted your microphone for this session.');
      return;
    }

    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
    setVersion((current) => current + 1);
  }

  async function toggleCamera() {
    if (!room) {
      return;
    }

    const next = !cameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
    setVersion((current) => current + 1);
  }

  async function toggleScreenShare() {
    if (!room) {
      return;
    }

    const next = !screenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(next);
    setScreenShareEnabled(next);
    setVersion((current) => current + 1);
  }

  if (!session) {
    return (
      <main className="room-shell room-shell--centered">
        <div className="panel status-card">
          <h1>Loading room...</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="room-shell">
      <header className="topbar">
        <div className="topbar__title">
          <span className="eyebrow">Room</span>
          <h1>{session.room_name}</h1>
          <p className="topbar__host">Hosted by {hostFirstName}</p>
        </div>
        <div className="topbar__meta">
          <span className={`status-dot ${status === 'connected' ? 'status-dot--live' : ''}`}>{status}</span>
          <span>{session.role === 'host' ? 'Host controls enabled' : 'Participant mode'}</span>
          {session.role === 'host' && (
            <button className="button-ghost button-danger-outline" onClick={() => void handleEndRoom()} disabled={endingRoom}>
              {endingRoom ? 'Ending room...' : 'End room'}
            </button>
          )}
        </div>
      </header>

      {error && <p className="status status--error">{error}</p>}
      {leaveMessage && <p className="status status--warning">{leaveMessage}</p>}

      <section className="room-layout">
        <div className="stage">
          <div className="stage__grid">
            {tiles.map((tile) => (
              <ParticipantTile
                key={tile.id}
                participant={tile.participant}
                publication={tile.publication}
                kind={tile.kind}
                isLocal={tile.participant.identity === session.identity}
              />
            ))}
          </div>

          <div className="stage__reactions">
            {reactions.map((reaction) => (
              <div key={reaction.id} className="reaction-chip">
                <span>{reaction.emoji}</span>
                <small>{reaction.senderName}</small>
              </div>
            ))}
          </div>

          <div className="controls">
            <button onClick={() => void toggleMicrophone()}>{micEnabled ? 'Mic on' : 'Mic off'}</button>
            <button onClick={() => void toggleCamera()}>{cameraEnabled ? 'Camera on' : 'Camera off'}</button>
            <button onClick={() => void toggleScreenShare()}>{screenShareEnabled ? 'Stop share' : 'Share screen'}</button>
            <button className="button-danger" onClick={() => void handleLeave()}>
              Leave room
            </button>
          </div>

          <ReactionBar disabled={!room} onReact={handleReaction} />
        </div>

        <ParticipantSidebar
          participants={participants}
          currentIdentity={session.identity}
          currentRole={session.role}
          onModerate={handleModeration}
          moderationBusyIdentity={moderationBusyIdentity}
        />

        <ChatPanel
          messages={messages}
          draft={draft}
          currentIdentity={session.identity}
          avatarLookup={avatarLookup}
          onDraftChange={setDraft}
          onSubmit={handleSendMessage}
          disabled={!room}
        />
      </section>

      {audioEntries.map((entry) => (
        <TrackRenderer key={entry.id} track={entry.track as never} audio />
      ))}
    </main>
  );
}

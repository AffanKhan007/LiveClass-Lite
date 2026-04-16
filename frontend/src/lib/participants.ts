import { Participant, Room, Track } from 'livekit-client';

type ParticipantMetadata = {
  displayName?: string;
  role?: 'host' | 'participant';
  avatarDataUrl?: string | null;
};

function parseParticipantMetadata(participant: Participant): ParticipantMetadata {
  if (!participant.metadata) {
    return {};
  }

  try {
    return JSON.parse(participant.metadata) as ParticipantMetadata;
  } catch {
    return {};
  }
}

export function participantRole(participant: Participant): 'host' | 'participant' {
  return parseParticipantMetadata(participant).role === 'host' ? 'host' : 'participant';
}

export function participantName(participant: Participant): string {
  if (participant.name) {
    return participant.name;
  }

  const parsed = parseParticipantMetadata(participant);
  if (parsed.displayName) {
    return parsed.displayName;
  }

  return participant.identity;
}

export function participantAvatarDataUrl(participant: Participant): string | null {
  return parseParticipantMetadata(participant).avatarDataUrl ?? null;
}

export function participantFirstName(participant: Participant): string {
  return participantName(participant).trim().split(/\s+/)[0] ?? participantName(participant);
}

export function getTrackPublication(participant: Participant, source: Track.Source) {
  return Array.from(participant.trackPublications.values()).find((publication) => publication.source === source);
}

export function buildTileEntries(room: Room) {
  const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];

  return participants.flatMap((participant) => {
    const camera = getTrackPublication(participant, Track.Source.Camera);
    const screen = getTrackPublication(participant, Track.Source.ScreenShare);

    const items: Array<{
      id: string;
      participant: Participant;
      publication: ReturnType<typeof getTrackPublication>;
      kind: 'camera' | 'screen';
    }> = [
      {
        id: `${participant.identity}-camera`,
        participant,
        publication: camera,
        kind: 'camera' as const,
      },
    ];

    if (screen?.track) {
      items.unshift({
        id: `${participant.identity}-screen`,
        participant,
        publication: screen,
        kind: 'screen' as const,
      });
    }

    return items;
  });
}

export function buildAudioEntries(room: Room) {
  return Array.from(room.remoteParticipants.values()).flatMap((participant) =>
    Array.from(participant.audioTrackPublications.values())
      .filter((publication) => publication.track)
      .map((publication) => ({
        id: `${participant.identity}-${publication.trackSid}`,
        track: publication.track,
      })),
  );
}

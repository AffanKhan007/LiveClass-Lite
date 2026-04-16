import { Participant } from 'livekit-client';
import { participantAvatarDataUrl, participantName, participantRole } from '../lib/participants';
import { Avatar } from './Avatar';
import { TrackRenderer } from './TrackRenderer';

type ParticipantTileProps = {
  participant: Participant;
  publication?: {
    track?: unknown;
  };
  kind: 'camera' | 'screen';
  isLocal: boolean;
};

export function ParticipantTile({ participant, publication, kind, isLocal }: ParticipantTileProps) {
  const name = participantName(participant);
  const avatarDataUrl = participantAvatarDataUrl(participant);
  const role = participantRole(participant);
  const isSpeaking = participant.isSpeaking && kind === 'camera';
  const hasVideo = Boolean(publication?.track);

  return (
    <article className={`participant-tile ${kind === 'screen' ? 'participant-tile--screen' : ''} ${isSpeaking ? 'participant-tile--speaking' : ''}`}>
      <div className="participant-tile__media">
        {hasVideo ? (
          <TrackRenderer track={publication?.track as never} muted={isLocal} className="participant-tile__video" />
        ) : (
          <div className="participant-tile__placeholder">
            <Avatar name={name} src={avatarDataUrl} size="lg" />
            <small>{kind === 'screen' ? 'Screen share inactive' : 'Camera off'}</small>
          </div>
        )}
      </div>
      <div className="participant-tile__footer">
        <div className="participant-tile__identity">
          <strong>{name}</strong>
          <span>{isLocal ? 'You' : kind === 'screen' ? 'Screen share' : 'Participant'}</span>
        </div>
        <div className="participant-tile__badges">
          {role === 'host' && <span className="badge">Host</span>}
          {isSpeaking && <span className="badge badge--active">Speaking</span>}
        </div>
      </div>
    </article>
  );
}

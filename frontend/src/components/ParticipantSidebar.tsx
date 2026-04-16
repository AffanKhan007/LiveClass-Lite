import { Participant } from 'livekit-client';
import { participantAvatarDataUrl, participantName, participantRole } from '../lib/participants';
import type { ModerationAction, ParticipantRole } from '../types';
import { Avatar } from './Avatar';

type ParticipantSidebarProps = {
  participants: Participant[];
  currentIdentity: string;
  currentRole: ParticipantRole;
  onModerate: (target: Participant, action: ModerationAction) => Promise<void>;
  moderationBusyIdentity: string | null;
};

export function ParticipantSidebar({
  participants,
  currentIdentity,
  currentRole,
  onModerate,
  moderationBusyIdentity,
}: ParticipantSidebarProps) {
  return (
    <aside className="panel sidebar">
      <div className="panel__header">
        <h2>Participants</h2>
        <span>{participants.length}</span>
      </div>
      <div className="sidebar__list">
        {participants.map((participant) => {
          const isCurrent = participant.identity === currentIdentity;
          const isHost = participantRole(participant) === 'host';
          const isBusy = moderationBusyIdentity === participant.identity;
          const statusLabel = isCurrent ? 'You' : participant.isSpeaking ? 'Speaking now' : 'Listening';
          const name = participantName(participant);

          return (
            <div key={participant.identity} className="sidebar__item">
              <div className="sidebar__summary">
                <div className="sidebar__identity">
                  <Avatar name={name} src={participantAvatarDataUrl(participant)} size="sm" />
                  <div className="sidebar__text">
                    <strong>{name}</strong>
                    <span>{statusLabel}</span>
                  </div>
                </div>
                <div className="participant-tile__badges">
                  {isHost && <span className="badge">Host</span>}
                </div>
              </div>
              {currentRole === 'host' && !isCurrent && (
                <div className="sidebar__actions">
                  <button disabled={isBusy} onClick={() => void onModerate(participant, 'mute')}>
                    Mute
                  </button>
                  <button className="button-danger" disabled={isBusy} onClick={() => void onModerate(participant, 'remove')}>
                    Kick
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

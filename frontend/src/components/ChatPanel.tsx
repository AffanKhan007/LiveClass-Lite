import { FormEvent } from 'react';
import type { ChatMessage } from '../types';
import { Avatar } from './Avatar';

type ChatPanelProps = {
  messages: ChatMessage[];
  draft: string;
  currentIdentity: string;
  avatarLookup: Record<string, string | null | undefined>;
  disabled?: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
};

export function ChatPanel({ messages, draft, currentIdentity, avatarLookup, disabled, onDraftChange, onSubmit }: ChatPanelProps) {
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit();
  }

  return (
    <section className="panel chat-panel">
      <div className="panel__header">
        <h2>Chat</h2>
      </div>
      <div className="chat-panel__messages">
        {messages.length === 0 ? (
          <p className="muted">No messages yet. Use chat to coordinate the session.</p>
        ) : (
          messages.map((message) => {
            const isSelf = message.participant_identity === currentIdentity;

            return (
              <div
                key={`${message.created_at}-${message.participant_identity}-${message.body}`}
                className={`chat-message-row ${isSelf ? 'chat-message-row--self' : ''}`}
              >
                {!isSelf && <Avatar name={message.display_name} src={avatarLookup[message.participant_identity]} size="sm" />}
                <div className={`chat-message ${isSelf ? 'chat-message--self' : ''}`}>
                  <div className="chat-message__meta">
                    <strong>{isSelf ? 'You' : message.display_name}</strong>
                    <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Send a quick message to the room"
          rows={3}
          maxLength={1000}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

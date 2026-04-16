const EMOJIS = ['👍', '👏', '🎉', '❤️', '😄'];

type ReactionBarProps = {
  disabled?: boolean;
  onReact: (emoji: string) => Promise<void>;
};

export function ReactionBar({ disabled, onReact }: ReactionBarProps) {
  return (
    <div className="reaction-bar">
      {EMOJIS.map((emoji) => (
        <button key={emoji} disabled={disabled} onClick={() => void onReact(emoji)} title={`Send ${emoji}`}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return 'U';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  return (
    <div className={`avatar avatar--${size}`}>
      {src ? <img src={src} alt={name} /> : <span>{initialsFor(name)}</span>}
    </div>
  );
}

import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { joinRoom } from '../lib/api';
import { resizeAvatarFile } from '../lib/avatarUpload';
import { saveSession } from '../lib/roomSession';

export function LandingPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const resizedAvatar = await resizeAvatarFile(file);
      setAvatarDataUrl(resizedAvatar);
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : 'Unable to use that image.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await joinRoom({ roomName, displayName, avatarDataUrl });
      saveSession(session);
      navigate(`/room/${session.room_name}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to join room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing-shell">
      <section className="landing-card">
        <div className="landing-copy">
          <span className="eyebrow">LiveKit-first mini classroom</span>
          <h1>LiveClass Lite</h1>
          <p>
            Spin up a lightweight study room with camera, microphone, screen share, chat, reactions, and simple host controls.
          </p>
        </div>

        <form className="landing-form" onSubmit={handleSubmit}>
          <label>
            Room name
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="study-room"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Guest User"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <div className="landing-avatar">
            <div className="landing-avatar__preview">
              <Avatar name={displayName || 'Guest User'} src={avatarDataUrl} size="lg" />
              <div>
                <strong>Profile picture</strong>
                <span>Optional for your participant tile and chat avatar.</span>
              </div>
            </div>
            <label className="landing-upload">
              <span>Upload image</span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>
          {error && <p className="status status--error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Joining...' : 'Create or Join Room'}
          </button>
        </form>
      </section>
    </main>
  );
}

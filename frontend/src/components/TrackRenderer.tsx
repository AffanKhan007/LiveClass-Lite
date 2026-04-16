import { useEffect, useRef } from 'react';
import type { LocalTrack, LocalVideoTrack, RemoteAudioTrack, RemoteTrack, RemoteVideoTrack } from 'livekit-client';

type MediaTrack = RemoteTrack | RemoteVideoTrack | LocalTrack | LocalVideoTrack | RemoteAudioTrack;

type TrackRendererProps = {
  track?: MediaTrack;
  audio?: boolean;
  muted?: boolean;
  className?: string;
};

export function TrackRenderer({ track, audio = false, muted = false, className }: TrackRendererProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = audio ? audioRef.current : videoRef.current;
    if (!element || !track) {
      return;
    }

    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  if (audio) {
    return <audio ref={audioRef} autoPlay muted={muted} />;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

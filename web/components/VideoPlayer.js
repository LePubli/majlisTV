'use client';
import { useEffect } from 'react';

// Lecteur vidéo : HLS via hls.js (qualité adaptative), lecture native sinon (Safari / iOS).
// videoRef : ref du parent pour piloter la lecture (transcription cliquable). tracks : [{ lang, label, src, isDefault }].
export default function VideoPlayer({ src, poster, tracks = [], videoRef }) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src; // Safari / iOS : HLS natif
      }
    });
    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [src, videoRef]);
  return (
    <video ref={videoRef} controls playsInline controlsList="nodownload" poster={poster || undefined}>
      {tracks.map((tr) => <track key={tr.lang} kind="subtitles" srcLang={tr.lang} label={tr.label} src={tr.src} default={tr.isDefault || undefined} />)}
    </video>
  );
}

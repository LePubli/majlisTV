'use client';
import { useEffect, useRef } from 'react';

// Lecteur vidéo : HLS via hls.js (qualité adaptative), lecture native sinon (Safari / iOS).
export default function VideoPlayer({ src, poster }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
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
  }, [src]);
  return <video ref={ref} controls playsInline controlsList="nodownload" poster={poster || undefined} />;
}

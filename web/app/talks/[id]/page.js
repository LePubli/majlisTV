'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useApp } from '../../../components/Providers';
import VideoPlayer from '../../../components/VideoPlayer';

export default function TalkPage() {
  const { id } = useParams();
  const { call, t } = useApp();
  const [talk, setTalk] = useState(undefined);

  // Rechargé quand la session change : un propriétaire/admin obtient le lien des vidéos premium.
  useEffect(() => { call('/talks/' + id).then((r) => setTalk(r.ok ? r.data : null)); }, [id, call]);

  // Pendant la conversion, la page se met à jour toute seule.
  const waiting = talk && talk.source === 'upload' && ['pending', 'processing'].includes(talk.status);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => call('/talks/' + id).then((r) => r.ok && setTalk(r.data)), 8000);
    return () => clearInterval(timer);
  }, [waiting, id, call]);

  if (talk === undefined) return null;
  if (talk === null) return <main className="page"><p>{t('noTalks')}</p></main>;
  const embed = talk.source === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${talk.video_ref}`
    : `https://player.vimeo.com/video/${talk.video_ref}`;

  let player;
  if (talk.source !== 'upload') {
    player = <div className="player"><iframe src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={talk.title} /></div>;
  } else if (talk.locked) {
    player = <p className="soon">{t('locked')}</p>;
  } else if (talk.hlsPath) {
    player = <div className="player"><VideoPlayer src={'/api' + talk.hlsPath} poster={talk.posterUrl} /></div>;
  } else if (talk.status === 'failed') {
    player = <p className="soon">{t('convFailed')}</p>;
  } else if (talk.videoUrl) {
    // Propriétaire / admin : aperçu du fichier d'origine pendant la conversion.
    player = (
      <>
        <p className="meta">{t('previewMsg')} {talk.status === 'processing' ? `${talk.progress} %` : ''}</p>
        <div className="player"><video controls controlsList="nodownload" src={talk.videoUrl} /></div>
      </>
    );
  } else {
    player = <p className="soon">{t('processingMsg')}</p>;
  }

  return (
    <main className="page">
      {player}
      <h1>{talk.title}</h1>
      <p className="meta">{talk.speaker} · {talk.language}{talk.category ? ` · ${talk.category}` : ''} · {t(talk.access)}
        {talk.durationSeconds ? ` · ${Math.max(1, Math.round(talk.durationSeconds / 60))} ${t('minutes')}` : ''}</p>
      <p>{talk.description}</p>
    </main>
  );
}

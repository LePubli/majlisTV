'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useApp } from '../../../components/Providers';

export default function TalkPage() {
  const { id } = useParams();
  const { call, t } = useApp();
  const [talk, setTalk] = useState(undefined);

  useEffect(() => { call('/talks/' + id, {}, null).then((r) => setTalk(r.ok ? r.data : null)); }, [id, call]);

  if (talk === undefined) return null;
  if (talk === null) return <main className="page"><p>{t('noTalks')}</p></main>;
  const src = talk.source === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${talk.video_ref}`
    : `https://player.vimeo.com/video/${talk.video_ref}`;
  return (
    <main className="page">
      <div className="player">
        <iframe src={src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={talk.title} />
      </div>
      <h1>{talk.title}</h1>
      <p className="meta">{talk.speaker} · {talk.language}{talk.category ? ` · ${talk.category}` : ''} · {t(talk.access)}</p>
      <p>{talk.description}</p>
    </main>
  );
}

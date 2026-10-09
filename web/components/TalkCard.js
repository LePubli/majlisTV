import Link from 'next/link';

// Vignette d'une conférence (miniature YouTube si disponible).
export default function TalkCard({ talk, t }) {
  const thumb = talk.posterUrl || (talk.source === 'youtube' ? `https://i.ytimg.com/vi/${talk.video_ref}/hqdefault.jpg` : null);
  return (
    <Link href={`/talks/${talk.id}`} className="talk">
      <div className="thumb" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
        <span className={`badge ${talk.access}`}>{t(talk.access)}</span>
        {talk.durationSeconds > 0 && <span className="dur">{Math.max(1, Math.round(talk.durationSeconds / 60))} {t('minutes')}</span>}
      </div>
      <h3>{talk.title}</h3>
      <p>{talk.speaker}{talk.category ? ` · ${talk.category}` : ''}</p>
    </Link>
  );
}

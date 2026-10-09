'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../components/Providers';
import { uploadFile } from '../../lib/upload';

const empty = { title: '', description: '', speaker: '', language: 'fr', categoryId: '', access: 'free', videoUrl: '' };

// Espace organisateur : ajout (lien YouTube/Vimeo ou fichier vidéo) et suppression de ses conférences.
export default function Organizer() {
  const { user, ready, t, call } = useApp();
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [mode, setMode] = useState('link');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [cats, setCats] = useState([]);
  const [mine, setMine] = useState([]);
  const [err, setErr] = useState('');
  const allowed = !!user && ['organizer', 'admin'].includes(user.role);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = useCallback(() => call('/me/talks').then((r) => r.ok && setMine(r.data)), [call]);

  // Rafraîchit la liste tant qu'une conversion est en cours.
  const converting = mine.some((x) => ['pending', 'processing'].includes(x.status)
    || (x.status === 'ready' && ['pending', 'processing'].includes(x.transcriptStatus)));
  useEffect(() => {
    if (!converting) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [converting, load]);
  const statusLabel = (x) => (x.status === 'pending' ? t('queued')
    : x.status === 'processing' ? `${t('converting')} ${x.progress} %`
    : x.status === 'failed' ? t('convFailed')
    : x.transcriptStatus === 'pending' ? `${t('transcribingList')} : ${t('queued').toLowerCase()}`
    : x.transcriptStatus === 'processing' ? `${t('transcribing')} ${x.transcriptProgress} %`
    : x.transcriptStatus === 'failed' ? t('transcriptFailed') : '');

  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  useEffect(() => {
    if (!allowed) return;
    load();
    call('/categories', {}, null).then((r) => r.ok && setCats(r.data));
  }, [allowed, load, call]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const body = { ...f, categoryId: f.categoryId ? Number(f.categoryId) : undefined };
    try {
      if (mode === 'file') {
        if (!file) return;
        delete body.videoUrl;
        setProgress(0);
        body.uploadId = await uploadFile(file, call, setProgress);
      }
      const r = await call('/talks', { method: 'POST', body: JSON.stringify(body) });
      if (r.ok) { setF(empty); setFile(null); load(); } else setErr(t('errVideo'));
    } catch (e2) {
      setErr(e2.message === 'tooBig' ? t('errTooBig') : t('errUpload'));
    }
    setProgress(null);
  };
  const remove = async (id) => { await call('/talks/' + id, { method: 'DELETE' }); load(); };

  if (!user) return null;
  if (!allowed) return <main className="card"><p>{t('noAccess')}</p></main>;
  const busy = progress !== null;
  return (
    <main className="page">
      <h1>{t('myTalks')}</h1>
      <form onSubmit={submit} className="form">
        <h2>{t('addTalk')}</h2>
        <label>{t('talkTitle')}<input required maxLength={200} value={f.title} onChange={set('title')} /></label>
        <label>{t('source')}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="link">{t('linkMode')}</option>
            <option value="file">{t('fileMode')}</option>
          </select>
        </label>
        {mode === 'link'
          ? <label>{t('videoUrl')}<input required type="url" value={f.videoUrl} onChange={set('videoUrl')} /></label>
          : <label>{t('videoFile')}<input required type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0] || null)} /></label>}
        <label>{t('speaker')}<input value={f.speaker} onChange={set('speaker')} /></label>
        <label>{t('description')}<textarea rows={4} value={f.description} onChange={set('description')} /></label>
        <label>{t('language')}<input required pattern="[a-z]{2}(-[A-Z]{2})?" value={f.language} onChange={set('language')} /></label>
        <label>{t('category')}
          <select value={f.categoryId} onChange={set('categoryId')}>
            <option value="">—</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>{t('access')}
          <select value={f.access} onChange={set('access')}>
            <option value="free">{t('free')}</option>
            <option value="premium">{t('premium')}</option>
          </select>
        </label>
        {busy && <><progress value={progress} max="1" /><p className="meta">{t('uploading')} {Math.round(progress * 100)} %</p></>}
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy}>{t('publish')}</button>
      </form>
      {mine.length === 0 && <p className="soon">{t('noTalks')}</p>}
      <ul className="mine">
        {mine.map((x) => (
          <li key={x.id}>
            <Link href={`/talks/${x.id}`}>{x.title}</Link>
            {statusLabel(x) && <span className={`status ${x.status === 'failed' || x.transcriptStatus === 'failed' ? 'failed' : ''}`}>{statusLabel(x)}</span>}
            <button className="link" onClick={() => remove(x.id)}>{t('delete')}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}

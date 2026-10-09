'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '../../components/Providers';

const empty = { title: '', description: '', speaker: '', language: 'fr', categoryId: '', access: 'free', videoUrl: '' };

// Espace organisateur : ajout et suppression de ses conférences.
export default function Organizer() {
  const { user, ready, t, call } = useApp();
  const router = useRouter();
  const [f, setF] = useState(empty);
  const [cats, setCats] = useState([]);
  const [mine, setMine] = useState([]);
  const [err, setErr] = useState('');
  const allowed = !!user && ['organizer', 'admin'].includes(user.role);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = useCallback(() => call('/me/talks').then((r) => r.ok && setMine(r.data)), [call]);

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
    const r = await call('/talks', { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) { setF(empty); load(); } else setErr(r.status === 400 ? t('errVideo') : t('errGeneric'));
  };
  const remove = async (id) => { await call('/talks/' + id, { method: 'DELETE' }); load(); };

  if (!user) return null;
  if (!allowed) return <main className="card"><p>{t('noAccess')}</p></main>;
  return (
    <main className="page">
      <h1>{t('myTalks')}</h1>
      <form onSubmit={submit} className="form">
        <h2>{t('addTalk')}</h2>
        <label>{t('talkTitle')}<input required maxLength={200} value={f.title} onChange={set('title')} /></label>
        <label>{t('videoUrl')}<input required type="url" value={f.videoUrl} onChange={set('videoUrl')} /></label>
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
        {err && <p className="error">{err}</p>}
        <button className="btn">{t('publish')}</button>
      </form>
      {mine.length === 0 && <p className="soon">{t('noTalks')}</p>}
      <ul className="mine">
        {mine.map((x) => (
          <li key={x.id}>
            <Link href={`/talks/${x.id}`}>{x.title}</Link>
            <button className="link" onClick={() => remove(x.id)}>{t('delete')}</button>
          </li>
        ))}
      </ul>
    </main>
  );
}

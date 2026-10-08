'use client';
import Link from 'next/link';
import { useApp } from '../components/Providers';

export default function Home() {
  const { t, appName, user } = useApp();
  return (
    <>
      <section className="hero">
        <h1>{appName}</h1>
        <p>{t('tagline')}</p>
        {!user && <Link href="/register" className="btn">{t('register')}</Link>}
      </section>
      <div className="rail">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} />)}</div>
      <p className="soon">{t('browse')}</p>
    </>
  );
}

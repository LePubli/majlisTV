'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../../components/Providers';

export default function Account() {
  const { user, ready, t } = useApp();
  const router = useRouter();
  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  if (!user) return null;
  return (
    <main className="card">
      <h1>{t('hello')} {user.name}</h1>
      <p>{user.email}</p>
      <p>{t('role')} : <strong>{user.role}</strong></p>
    </main>
  );
}

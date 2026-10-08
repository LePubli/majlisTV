import { cookies } from 'next/headers';
import './globals.css';
import Providers from '../components/Providers';
import Header from '../components/Header';
import { DICT, DIR, getLocale } from '../lib/i18n';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => ({ title: process.env.APP_NAME || 'Majlis TV', icons: { icon: '/favicon.svg' } });

export default function RootLayout({ children }) {
  const locale = getLocale(cookies().get('locale')?.value);
  const appName = process.env.APP_NAME || 'Majlis TV';
  return (
    <html lang={locale} dir={DIR[locale]}>
      <body>
        <Providers locale={locale} dict={DICT[locale]} appName={appName}>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}

import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import NextNProgress from 'nextjs-progressbar';
import useStore from '../store';
import '../styles/globals.css';
import Script from 'next/script';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const { setTheme } = useStore();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (
      localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
      setTheme('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      setTheme('light');
      localStorage.setItem('theme', 'light');
    }

    document.body.classList.add('dark:bg-dark');
  }, [setTheme]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!GA_ID) return;
    const handleRouteChange = (url: string) => {
      const w: any = window;
      w.gtag && w.gtag('config', GA_ID, { page_path: url });
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, GA_ID]);

  return (
    <SessionProvider session={session}>
      <NextNProgress
        color='rgb(254 44 85)'
        startPosition={0.1}
        stopDelayMs={100}
        height={3}
        options={{ showSpinner: false }}
      />
      {isClient && GA_ID && (
        <Script
          id='ga-loader'
          strategy='afterInteractive'
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
      )}
      {isClient && GA_ID && (
        <Script id='ga-init' strategy='afterInteractive'>
          {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { page_path: window.location.pathname });
            `}
        </Script>
      )}
      {isClient &&
        process.env.NEXT_SHOW_ADSTRA_ADS === 'true' &&
        process.env.NEXT_ONLY_VIDEO_BOTTOM_ADS !== 'true' && (
          <Script
            id='adstra-head'
            strategy='afterInteractive'
            src='//bunchhigher.com/f9/ec/19/f9ec19fd63fe021bb37fbad13f97cecc.js'
          />
        )}
      {isClient &&
        process.env.NEXT_SHOW_ADSTRA_ADS === 'true' &&
        process.env.NEXT_ONLY_VIDEO_BOTTOM_ADS !== 'true' && (
          <Script
            id='adstra-popunder'
            strategy='afterInteractive'
            src='//bunchhigher.com/b3/32/34/b33234daaf777c92e3d2b4a4fbea36bf.js'
          />
        )}
      <Component {...pageProps} />
    </SessionProvider>
  );
}

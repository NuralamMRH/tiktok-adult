import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import NextNProgress from 'nextjs-progressbar';
import useStore from '../store';
import '../styles/globals.css';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const { setTheme } = useStore();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const showAdstraAds =
    (process.env.NEXT_PUBLIC_SHOW_ADSTRA_ADS ??
      process.env.NEXT_SHOW_ADSTRA_ADS) === 'true';

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
    if (!isClient) return;

    const ensureExternalScript = (id: string, src: string) => {
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing) return existing;

      const script = document.createElement('script');
      script.id = id;
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
      return script;
    };

    const ensureInlineScript = (id: string, code: string) => {
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing) return existing;

      const script = document.createElement('script');
      script.id = id;
      script.text = code;
      document.head.appendChild(script);
      return script;
    };

    let gaLoader: HTMLScriptElement | null = null;
    let gaInit: HTMLScriptElement | null = null;
    let adstraHead: HTMLScriptElement | null = null;
    let adstraPop: HTMLScriptElement | null = null;

    if (GA_ID) {
      gaLoader = ensureExternalScript(
        'ga-loader',
        `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
      );
      gaInit = ensureInlineScript(
        'ga-init',
        `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}', { page_path: window.location.pathname });
        `.trim(),
      );
    }

    if (showAdstraAds) {
      adstraHead = ensureExternalScript(
        'adstra-head',
        'https://pl27803066.effectivegatecpm.com/f9/ec/19/f9ec19fd63fe021bb37fbad13f97cecc.js',
      );
      // adstraPop = ensureExternalScript(
      //   'adstra-popunder',
      //   'https://pl27848943.effectivegatecpm.com/b3/32/34/b33234daaf777c92e3d2b4a4fbea36bf.js',
      // );
    }

    return () => {
      gaLoader?.remove();
      gaInit?.remove();
      adstraHead?.remove();
      (adstraPop as any)?.remove();
    };
  }, [isClient, GA_ID, showAdstraAds]);

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
      <Component {...pageProps} />
    </SessionProvider>
  );
}

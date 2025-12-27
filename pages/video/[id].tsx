import axios from 'axios';
import Head from 'next/head';
import { ROOT_URL } from '../../utils';
import { Video } from '../../types';
import { RxCross2 } from 'react-icons/rx';
import { useRouter } from 'next/router';
import { MouseEvent, useCallback, useEffect } from 'react';
import NoResult from '../../components/NoResult';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { GetServerSidePropsContext } from 'next';
import { AUTH_OPTIONS } from '../api/auth/[...nextauth]';
import useStore from '../../store';
import VideoItem from '../../components/videoItem';
import type { TIntersectingVideo } from '..';

interface DetailProps {
  videoDetail: Video;
  origin: string;
}

export default function VideoDetail({ videoDetail, origin }: DetailProps) {
  const router = useRouter();
  const { setIsRestore, isMute, toggleMute, setCurrentVideo } = useStore();

  const normalizedOrigin = (
    origin ||
    process.env.NEXT_PUBLIC_ROOT_URL ||
    'http://localhost:3000'
  )
    .toString()
    .replace(/\/$/, '');
  const postId = (router.query.id as string) || videoDetail?._id;
  const postUrl = postId
    ? `${normalizedOrigin}/video/${postId}`
    : normalizedOrigin;

  const caption = (videoDetail?.caption || '').toString().trim();
  const topic = (videoDetail?.topic || '').toString().trim();
  const imageUrl = (videoDetail?.imageUrl || '').toString().trim();

  const handleMute = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleMute();
    },
    [toggleMute],
  );

  const handleIntersectingChange = useCallback(
    (video: TIntersectingVideo) => {
      const { inView, videoRef } = video;
      const videoElem = videoRef.current;
      if (!videoElem) return;

      if (!inView) {
        videoElem.pause();
        videoElem.currentTime = 0;
        setCurrentVideo(videoRef, false);
        return;
      }

      videoElem.play().catch(() => {});
      setCurrentVideo(videoRef, true);
    },
    [setCurrentVideo],
  );

  const TITLE = !videoDetail
    ? 'No video found'
    : `${caption || 'Video'}${topic ? ` - ${topic}` : ''} | XXX DESHI Video`;

  const DESCRIPTION = !videoDetail
    ? 'No video found'
    : `${caption || 'Watch this video'}${topic ? ` | ${topic}` : ''}`;

  useEffect(() => {
    const onBeforeHistoryChange = () => {
      setIsRestore(true);
    };

    router.events.on('beforeHistoryChange', onBeforeHistoryChange);

    return () => {
      router.events.off('beforeHistoryChange', onBeforeHistoryChange);
    };
  }, [router.events, setIsRestore]);

  useEffect(() => {
    setCurrentVideo(null, false);
  }, [setCurrentVideo]);

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <link rel='canonical' href={postUrl} />
        <meta property='og:url' content={postUrl}></meta>
        <meta property='og:type' content='video.other'></meta>
        <meta property='og:title' content={TITLE}></meta>
        <meta property='og:description' content={DESCRIPTION}></meta>
        {imageUrl ? <meta property='og:image' content={imageUrl}></meta> : null}
        <meta
          name='twitter:card'
          content={imageUrl ? 'summary_large_image' : 'summary'}
        ></meta>
        <meta name='twitter:title' content={TITLE}></meta>
        <meta name='twitter:description' content={DESCRIPTION}></meta>
        {imageUrl ? (
          <meta name='twitter:image' content={imageUrl}></meta>
        ) : null}
        {caption ? <meta name='caption' content={caption}></meta> : null}
        {topic ? <meta name='topic' content={topic}></meta> : null}
        <meta name='site_url' content={normalizedOrigin}></meta>
        <meta name='description' content={DESCRIPTION}></meta>
      </Head>

      {!videoDetail ? (
        <>
          <NoResult title='No video found!' />
          <Link
            href='/'
            className='mt-2 block text-center text-sm font-bold text-primary hover:underline'
          >
            Back to home
          </Link>
        </>
      ) : (
        <>
          <div className='flex w-full flex-col dark:bg-dark dark:text-white lg:min-h-screen lg:flex-row'>
            <div className='relative w-full bg-img-blur-light bg-cover bg-no-repeat object-cover dark:bg-img-blur-dark lg:flex-1'>
              <div
                onClick={() => router.back()}
                title='back'
                className='absolute left-2 top-2 z-40 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#7e7b7b5e] text-white hover:bg-[#5c59595e] xs:flex'
              >
                <RxCross2 size={23} />
              </div>

              <VideoItem
                post={videoDetail}
                isMute={isMute}
                handleMute={handleMute}
                handleIntersectingChange={handleIntersectingChange}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { params, req, res } = context;
  const session = await getServerSession(req, res, AUTH_OPTIONS);
  const videoId = params?.id;
  const currentUserId = session?._id;

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader || 'http';
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || '';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const origin = host ? `${proto}://${host}` : ROOT_URL;

  const response = await axios.get(
    `${origin}/api/post/${videoId}?currentUserId=${currentUserId ?? ''}`,
  );

  return { props: { videoDetail: response.data, origin } };
}

import axios from 'axios';
import Head from 'next/head';
import { Video } from '../types';
import VideoItem from '../components/videoItem';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ROOT_URL } from '../utils';
import Layout from '../components/Layout';
import { GetServerSidePropsContext } from 'next';
import NoResult from '../components/NoResult';
import useStore from '../store';
import { getServerSession } from 'next-auth/next';
import { AUTH_OPTIONS } from './api/auth/[...nextauth]';
import { useRestorePreviousScroll } from '../hooks/usePrevScroll';
import { useRouter } from 'next/router';
import { closeSidebar } from '../utils/sidebar-drawer';

const metadata = {
  description:
    'XXXX DESHI, Best XXX TikTok videos on XXX DESHI. Watch uncut, uncensored viral bangladeshi Indian Deshi XXX videos and mms now. XXX Desi MMS x clips awaits for you. XXX deshi Enjoy some of the hottest and newest leaked out Desi XXX available online for free xxxdeshi.xyz',
  title: 'XXX DESHI - Make Your Night',
};

interface Props {
  videos: Video[];
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}
export type TIntersectingVideo = {
  inView: boolean;
  id: string;
  videoRef: React.RefObject<HTMLVideoElement>;
};

export default function Home({
  videos,
  page: initialPage = 1,
  limit = 10,
  currentUserId,
}: Props) {
  const router = useRouter();
  const {
    currentVideo,
    setCurrentVideo,
    setVideoContainerRef,
    isMute,
    toggleMute,
    isRestore,
  } = useStore();

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [feedVideos, setFeedVideos] = useState<Video[]>(videos);
  const [page, setPage] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  useRestorePreviousScroll(videoContainerRef);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    if (router.query.caption || router.query.topic) return;
    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      const { data } = await axios.get(
        `${ROOT_URL}/api/post?currentUserId=${currentUserId ?? ''}&page=${nextPage}&limit=${limit}`,
      );
      const newVideos: Video[] = data || [];
      if (!newVideos.length) {
        // loop back to the beginning
        const { data: loopData } = await axios.get(
          `${ROOT_URL}/api/post?currentUserId=${currentUserId ?? ''}&page=1&limit=${limit}`,
        );
        const loopVideos: Video[] = loopData || [];
        if (!loopVideos.length) {
          setHasMore(false);
        } else {
          setFeedVideos((prev: Video[]) => [...prev, ...loopVideos]);
          setPage(1);
          setHasMore(true);
        }
      } else {
        // append directly to allow circular repetition
        setFeedVideos((prev: Video[]) => [...prev, ...newVideos]);
        setPage(nextPage);
      }
    } catch (_) {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    router.query.caption,
    router.query.topic,
    page,
    currentUserId,
    limit,
  ]);

  const handleIntersectingChange = useCallback(
    (video: TIntersectingVideo) => {
      const { inView, videoRef, id } = video;
      const videoElem = videoRef.current;

      if (!videoElem) return;

      if (!inView) {
        videoElem.pause();
        videoElem.currentTime = 0;
        return;
      }

      videoElem.play();
      setCurrentVideo(videoRef, true);

      const idx = feedVideos.findIndex((v: Video) => v._id === id);
      if (idx !== -1 && feedVideos.length - idx <= 9) {
        loadMore();
      }
    },
    [setCurrentVideo, feedVideos, loadMore],
  );

  // handle mute/unmute
  useEffect(() => {
    const video = currentVideo.videoRef?.current;
    if (!video) return;

    video.muted = isMute;
  }, [isMute, currentVideo]);

  const handleMute = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleMute();
    },
    [toggleMute],
  );

  // set videoContainerRef to global store
  useEffect(() => {
    if (!videoContainerRef) return;
    setVideoContainerRef(videoContainerRef);
  }, [setVideoContainerRef, videoContainerRef]);

  // reset scroll position after topic change
  // Omit `isRestore` from effect's dependency array to avoid unnecessary render
  useEffect(() => {
    const videoContainer = videoContainerRef.current;
    if (!videoContainer || isRestore) return;

    videoContainer.scrollTop = 0;

    // close sidebar on topic change
    closeSidebar();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.topic, router.query.caption]);

  return (
    <Layout>
      <Head>
        <title>{metadata.title}</title>
        <meta name='description' content={metadata.description} />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
        <meta property='og:title' content={metadata.title} />
        <meta property='og:description' content={metadata.description} />
        <meta property='og:url' content='https://xxxdeshi.xyz/'></meta>
        <meta
          property='og:image'
          content='https://dev-to-uploads.s3.amazonaws.com/uploads/articles/kdb7qa7aav7vww7ayiki.png'
        />
      </Head>

      <div
        ref={videoContainerRef}
        style={{
          height:
            'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
          scrollbarWidth: 'none',
          scrollSnapType: 'y mandatory',
        }}
        className='video-container w-full space-y-0 overflow-y-auto px-0 md:space-y-6 md:px-10'
      >
        {feedVideos?.length > 0 ? (
          feedVideos.map((video: Video) => (
            <VideoItem
              handleIntersectingChange={handleIntersectingChange}
              key={video._id}
              post={video}
              isMute={isMute}
              handleMute={handleMute}
            />
          ))
        ) : (
          <NoResult title='No video found!' />
        )}
        {isLoadingMore && (
          <div className='flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-300'>
            Loading more...
          </div>
        )}
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const topic = context.query.topic;
  const caption = context.query.caption;
  let videos;
  let page = 1;
  let limit = 10;

  // retrieve user
  const session = await getServerSession(
    context.req,
    context.res,
    AUTH_OPTIONS,
  );
  const currentUserId = session?._id;

  // query videos
  if (caption) {
    const { data } = await axios.get(
      `${ROOT_URL}/api/post/discoverCaption/${caption}?currentUserId=${currentUserId ?? ''}`,
    );
    videos = data;
    page = 1;
    limit = (Array.isArray(videos) ? videos.length : 10) || 10;
  } else if (topic) {
    const { data } = await axios.get(
      `${ROOT_URL}/api/post/discover/${topic}?currentUserId=${currentUserId ?? ''}`,
    );
    videos = data;
    page = 1;
    limit = (Array.isArray(videos) ? videos.length : 10) || 10;
  } else {
    const maxPageWithinWindow = 5;
    page = Number(
      context.query.page ?? Math.floor(Math.random() * maxPageWithinWindow) + 1,
    );
    limit = Number(context.query.limit ?? 10);
    const { data } = await axios.get(
      `${ROOT_URL}/api/post?currentUserId=${currentUserId ?? ''}&page=${page}&limit=${limit}`,
    );
    videos = data;
    if (!Array.isArray(videos) || videos.length === 0) {
      page = 1;
      const { data: fallback } = await axios.get(
        `${ROOT_URL}/api/post?currentUserId=${currentUserId ?? ''}&page=1&limit=${limit}`,
      );
      videos = fallback;
    }
  }

  return {
    props: { videos, page, limit, currentUserId: currentUserId ?? null },
  };
}

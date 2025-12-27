import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import Script from 'next/script';
import { User, Video } from '../types';
import VideoItem from '../components/videoItem';
import {
  Fragment,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { InView } from 'react-intersection-observer';
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
import useSWR from 'swr';
import Image from 'next/image';
import millify from 'millify';
import { AnimatePresence, motion } from 'framer-motion';
import useFollow from '../hooks/useFollow';
import { useSession } from 'next-auth/react';
import NotLoginModal from '../components/modal/NotLoginModal';

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
    suggestedUsers,
    setSuggestedUsers,
  } = useStore();

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [feedVideos, setFeedVideos] = useState<Video[]>(videos);
  const [page, setPage] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [slotUsersMap, setSlotUsersMap] = useState<Record<number, User[]>>({});
  useRestorePreviousScroll(videoContainerRef);

  useEffect(() => {
    setIsClient(true);
  }, []);

  async function getAllUsers() {
    const { data: allUsers } = await axios.get(`${ROOT_URL}/api/user`);
    return allUsers as User[];
  }

  const { data: allUsers } = useSWR(
    isClient ? 'getAllUsers' : null,
    getAllUsers,
  );

  const initialSuggestedUsersSet = useRef(false);
  useEffect(() => {
    if (initialSuggestedUsersSet.current) return;
    if (!allUsers?.length) return;
    const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
    setSuggestedUsers(shuffled);
    initialSuggestedUsersSet.current = true;
  }, [allUsers, setSuggestedUsers]);

  const suggestedPoolRef = useRef<User[]>([]);
  const suggestedCursorRef = useRef(0);

  useEffect(() => {
    const pool = (suggestedUsers || []).filter((u) =>
      currentUserId ? u._id !== currentUserId : true,
    );
    suggestedPoolRef.current = pool;
    if (suggestedCursorRef.current >= pool.length) {
      suggestedCursorRef.current = 0;
    }
  }, [suggestedUsers, currentUserId]);

  const shuffleUsers = useCallback((users: User[]) => {
    const arr = [...users];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }, []);

  const pickNextSuggestedUsers = useCallback(
    (count: number) => {
      let pool = suggestedPoolRef.current;
      if (!pool.length) return [];

      if (suggestedCursorRef.current + count > pool.length) {
        pool = shuffleUsers(pool);
        suggestedPoolRef.current = pool;
        suggestedCursorRef.current = 0;
      }

      const batch = pool.slice(
        suggestedCursorRef.current,
        suggestedCursorRef.current + count,
      );
      suggestedCursorRef.current += count;
      return batch;
    },
    [shuffleUsers],
  );

  function InlineAd({
    adKey,
    height,
    width,
  }: {
    adKey: string;
    height: number;
    width: number;
  }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';

      (window as typeof window & { atOptions?: unknown }).atOptions = {
        key: adKey,
        format: 'iframe',
        height,
        width,
        params: {},
      };

      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
      container.appendChild(script);

      return () => {
        container.innerHTML = '';
      };
    }, [adKey, height, width]);

    return <div ref={containerRef} className='h-full w-full' />;
  }

  function SuggestedUsersCarouselSlide({ slotId }: { slotId: number }) {
    const users = slotUsersMap[slotId] || [];
    const { data: user }: any = useSession();
    const {
      loading: followLoading,
      handleFollow,
      handleUnFollow,
    } = useFollow();
    const [activeIdx, setActiveIdx] = useState(0);
    const [direction, setDirection] = useState(0);
    const [localUsers, setLocalUsers] = useState<User[]>(users);
    const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [adVisible, setAdVisible] = useState(false);
    const isInViewRef = useRef(false);
    const hasRequestedForThisViewRef = useRef(false);

    useEffect(() => {
      setLocalUsers(users);
      setActiveIdx(0);
    }, [users, slotId]);

    const activeUser = localUsers[activeIdx];

    const followHandler = useCallback(async () => {
      if (!activeUser) return;
      if (!user?._id) return setShowLogin(true);

      const isAlreadyFollow = !!activeUser.follower?.some(
        (u) => u._ref === user._id,
      );

      setLoadingUserId(activeUser._id);
      try {
        const obj = { userId: user._id, creatorId: activeUser._id };
        const updatedUsers = isAlreadyFollow
          ? await handleUnFollow(obj)
          : await handleFollow(obj);
        const updatedCreator = updatedUsers?.find(
          (u) => u?._id === activeUser._id,
        ) as User | undefined;
        if (!updatedCreator?._id) return;

        setLocalUsers((prev) =>
          prev.map((u) =>
            u._id === updatedCreator._id
              ? {
                  ...u,
                  follower: updatedCreator.follower ?? u.follower,
                  followerCount:
                    updatedCreator.followerCount ?? u.followerCount,
                }
              : u,
          ),
        );
      } catch {
      } finally {
        setLoadingUserId(null);
      }
    }, [activeUser, handleFollow, handleUnFollow, user?._id]);

    const goTo = useCallback(
      (nextIdx: number) => {
        if (!localUsers.length) return;
        const clamped = Math.max(0, Math.min(localUsers.length - 1, nextIdx));
        if (clamped === activeIdx) return;
        setDirection(clamped > activeIdx ? 1 : -1);
        setActiveIdx(clamped);
      },
      [activeIdx, localUsers.length],
    );

    const next = useCallback(() => goTo(activeIdx + 1), [activeIdx, goTo]);
    const prev = useCallback(() => goTo(activeIdx - 1), [activeIdx, goTo]);

    function sanitizeUrl(u: string) {
      if (!u) return '';
      return u.trim().replace(/[)]+$/g, '');
    }

    const requestUsers = useCallback(() => {
      const count = Math.floor(Math.random() * 3) + 3;
      const nextUsers = pickNextSuggestedUsers(count);
      if (!nextUsers.length) return;
      setSlotUsersMap((prevMap) => ({ ...prevMap, [slotId]: nextUsers }));
    }, [pickNextSuggestedUsers, slotId]);

    useEffect(() => {
      if (users.length) return;
      if (!isInViewRef.current) return;
      if (hasRequestedForThisViewRef.current) return;
      if (!suggestedUsers?.length) return;
      requestUsers();
      hasRequestedForThisViewRef.current = true;
    }, [requestUsers, suggestedUsers, users.length]);

    return (
      <>
        {showLogin && <NotLoginModal onClose={() => setShowLogin(false)} />}
        <InView
          as='div'
          threshold={0.01}
          rootMargin='600px 0px'
          initialInView={false}
          triggerOnce={false}
          onChange={(inView, entry) => {
            isInViewRef.current = inView;
            setAdVisible(inView && (entry?.intersectionRatio ?? 0) >= 0.6);
            if (!inView) {
              hasRequestedForThisViewRef.current = false;
              return;
            }
            if (!users.length && suggestedUsers?.length) {
              requestUsers();
              hasRequestedForThisViewRef.current = true;
            }
          }}
          style={{
            height:
              'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
            scrollSnapStop: 'always',
            scrollSnapAlign: 'start center',
          }}
          className='relative w-full bg-black'
        >
          {process.env.NEXT_SHOW_ADSTRA_ADS === 'true' && adVisible && (
            <div className='pointer-events-auto absolute left-1/2 top-6 z-10 -translate-x-1/2'>
              <div className='h-[250px] w-[320px]'>
                <InlineAd
                  adKey='446cc2bf6c736ad4493623200de984b7'
                  height={250}
                  width={320}
                />
              </div>
            </div>
          )}
          <div className='absolute inset-0 flex items-center justify-center p-4'>
            <div className='relative w-full max-w-[360px]'>
              <AnimatePresence mode='wait' initial={false}>
                {activeUser ? (
                  <motion.div
                    key={activeUser._id}
                    className='w-full overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-darkSecondary'
                    initial={{
                      opacity: 0,
                      x: direction > 0 ? 120 : -120,
                      rotate: direction > 0 ? 6 : -6,
                      scale: 0.96,
                    }}
                    animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: direction > 0 ? -160 : 160,
                      rotate: direction > 0 ? -8 : 8,
                      scale: 0.96,
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    drag='x'
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.15}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -90) next();
                      else if (info.offset.x > 90) prev();
                    }}
                  >
                    <div className='p-5 text-center'>
                      <div className='mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-darkBtn'>
                        {activeUser.image && (
                          <Image
                            src={sanitizeUrl(activeUser.image)}
                            alt='user'
                            width={96}
                            height={96}
                            className='h-full w-full object-cover'
                          />
                        )}
                      </div>

                      <div className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                        {activeUser.userName}
                      </div>
                      <div className='mt-1 text-sm text-gray-500 dark:text-gray-300'>
                        {millify(
                          activeUser.followerCount ??
                            activeUser.follower?.length ??
                            0,
                        )}{' '}
                        followers
                      </div>

                      <div className='mt-5 grid grid-cols-2 gap-3'>
                        <button
                          type='button'
                          disabled={
                            followLoading || loadingUserId === activeUser._id
                          }
                          onClick={followHandler}
                          className={`${
                            activeUser.follower?.some(
                              (u) => u._ref === user?._id,
                            )
                              ? 'btn-secondary'
                              : 'btn-primary'
                          } w-full py-2 text-sm font-semibold`}
                        >
                          {activeUser.follower?.some(
                            (u) => u._ref === user?._id,
                          )
                            ? 'Following'
                            : 'Follow'}
                        </button>

                        <Link
                          href={`/profile/${activeUser._id}`}
                          onClick={(e) => {
                            if (user?._id) return;
                            e.preventDefault();
                            setShowLogin(true);
                          }}
                          className='btn-secondary inline-flex w-full items-center justify-center py-2 text-sm font-semibold'
                        >
                          View videos
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key='loading'
                    className='w-full rounded-2xl bg-white/90 p-6 text-center text-sm text-gray-700 shadow-xl dark:bg-darkSecondary dark:text-gray-200'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Loading...
                  </motion.div>
                )}
              </AnimatePresence>

              {localUsers.length > 1 && (
                <div className='mt-4 flex items-center justify-center gap-2'>
                  {localUsers.map((u, i) => (
                    <button
                      key={u._id}
                      type='button'
                      onClick={() => goTo(i)}
                      className={`h-2 w-2 rounded-full ${
                        i === activeIdx ? 'bg-white' : 'bg-white/40'
                      }`}
                      aria-label={`slide-${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {process.env.NEXT_SHOW_ADSTRA_ADS === 'true' && adVisible && (
            <div className='pointer-events-auto absolute bottom-2 left-1/2 z-10 -translate-x-1/2'>
              <Script
                id='adstra-invoke-profile'
                strategy='lazyOnload'
                src='//bunchhigher.com/34ad64cee096a6379cfbc810d1fc4a17/invoke.js'
              />
              <div
                id='container-34ad64cee096a6379cfbc810d1fc4a17'
                className='my-4'
              />
            </div>
          )}
        </InView>
      </>
    );
  }

  const adSlots = useMemo(() => {
    const intervals = [7, 12];
    const slots = new Set<number>();
    let pos = -1;
    let i = 0;

    while (pos < feedVideos.length - 1) {
      pos += intervals[i % intervals.length];
      if (pos >= feedVideos.length) break;
      slots.add(pos);
      i++;
    }

    return slots;
  }, [feedVideos.length]);

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
    } catch {
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
  }, [router.query.topic, router.query.caption]);

  return (
    <Layout>
      <Head>
        <title>{metadata.title}</title>
        <meta name='description' content={metadata.description} />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' href='/favicon.ico' />
        {process.env.NEXT_SHOW_ADSTRA_ADS === 'true' && (
          <>
            <link rel='dns-prefetch' href='//bunchhigher.com' />
            <link rel='preconnect' href='https://bunchhigher.com' />
            <link
              rel='preload'
              as='script'
              href='//bunchhigher.com/34ad64cee096a6379cfbc810d1fc4a17/invoke.js'
            />
          </>
        )}
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
          feedVideos.map((video: Video, idx: number) => (
            <Fragment key={video._id}>
              <VideoItem
                handleIntersectingChange={handleIntersectingChange}
                post={video}
                isMute={isMute}
                handleMute={handleMute}
              />
              {isClient &&
                process.env.NEXT_SHOW_ADSTRA_ADS === 'true' &&
                adSlots.has(idx) && (
                  <SuggestedUsersCarouselSlide slotId={idx} />
                )}
            </Fragment>
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

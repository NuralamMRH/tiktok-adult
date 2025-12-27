import Head from 'next/head';
import Script from 'next/script';
import Layout from '../../components/Layout';
import axios from 'axios';
import { ROOT_URL } from '../../utils';
import { User, Video } from '../../types';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BsHeartFill } from 'react-icons/bs';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import NoResult from '../../components/NoResult';
import TabItem from '../../components/TabItem';
import Header from './Header';
import millify from 'millify';
import useStore from '../../store';
import { useSetPrevScroll } from '../../hooks/usePrevScroll';
import { closeSidebar } from '../../utils/sidebar-drawer';

interface Props {
  data: {
    user: User;
    userCreatedPosts: Video[];
    userLikedPosts: Video[];
  };
}

interface VideoItemProps {
  videoURL: string;
  likes: number;
  caption: string;
  videoId: string;
  onVideoClick: VoidFunction;
}

function VideoItem({
  videoURL,
  likes,
  caption,
  videoId,
  onVideoClick,
}: VideoItemProps) {
  return (
    <Link
      onClick={onVideoClick}
      href={`/video/${videoId}`}
      className='flex w-full min-w-0 flex-col'
    >
      <div className='relative flex h-[260px] w-full items-center justify-center overflow-hidden rounded-md bg-black xs:h-[290px] sm:h-[250px]'>
        <video src={videoURL} className='h-full w-full object-cover' />

        <div className='absolute bottom-0 left-0 flex w-full items-center p-2 py-3 text-sm text-white backdrop-blur-sm'>
          <BsHeartFill size={18} className='mr-1' /> {millify(likes)}
        </div>
      </div>
      <p className='mt-1 line-clamp-1 self-start text-sm text-gray-900 dark:text-gray-300'>
        {caption}
      </p>
    </Link>
  );
}

export default function Profile({ data }: Props) {
  // destructure
  const { user: userInfo, userCreatedPosts, userLikedPosts } = data;

  // states
  const [user, setUser] = useState(userInfo);
  const [tab, setTab] = useState(0);

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const shouldRestoreScroll = useRef<boolean>(true);

  // hooks
  const { data: currentUser }: any = useSession();
  const router = useRouter();
  const {
    setCurrentVideo,
    setIsRestore,
    prevScroll,
    isRestore,
    setPrevScroll,
  } = useStore();
  const { keepScrollBeforeNavigate } = useSetPrevScroll(containerRef);

  const isCurrentUserProfile = user?._id === currentUser?._id;

  const hasNoUser =
    !userInfo && !userCreatedPosts.length && !userLikedPosts.length;

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  // init tab
  useEffect(() => {
    setTab(0);
    setUser(userInfo);
    closeSidebar();
  }, [router.query.id, userInfo]);

  // set current playing video to null, since it is in profile page and no video is playing
  useEffect(() => {
    setCurrentVideo(null, false);
  }, [setCurrentVideo]);

  // Set isRestore to true before history change to keep previous scroll in next page
  useEffect(() => {
    const onBeforeHistoryChange = () => {
      shouldRestoreScroll.current = false; // don't restore scroll in this page

      if (prevScroll) {
        setIsRestore(true);
      }
    };

    router.events.on('beforeHistoryChange', onBeforeHistoryChange);

    return () => {
      router.events.off('beforeHistoryChange', onBeforeHistoryChange);
    };
  }, [router.events, setIsRestore, prevScroll]);

  // restore scroll based on conditions
  useEffect(() => {
    if (!shouldRestoreScroll.current || !isRestore) return;

    const elem = containerRef?.current;
    if (!elem) return;

    elem.scrollTop = prevScroll;

    // reset scroll state after scroll
    setPrevScroll(0);
    setIsRestore(false);
  }, [isRestore, prevScroll, setIsRestore, setPrevScroll]);

  const TITLE = hasNoUser ? 'No User Found' : `${user?.userName} | xxxdeshi`;

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

  return (
    <Layout>
      <Head>
        <title>{TITLE}</title>
        <meta
          property='og:url'
          content={`https://xxxdeshi.xyz/profile/${router.query.id}`}
        ></meta>
      </Head>

      <div
        ref={containerRef}
        style={{
          height:
            'calc(100vh - 97px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        }}
        className='profile-container overflow-y-auto pl-2 sm:pl-4'
      >
        {hasNoUser ? (
          <NoResult title='No user found!' />
        ) : (
          <>
            <Header
              bioRef={bioRef}
              user={user}
              setUser={setUser}
              userCreatedPosts={userCreatedPosts}
            />

            <div className='mt-4'>
              {/* tab menu */}
              <div className='flex items-center'>
                <TabItem name='Videos' tabIdx={0} tab={tab} setTab={setTab} />
                <TabItem name='Liked' tabIdx={1} tab={tab} setTab={setTab} />
              </div>

              {isClient && process.env.NEXT_SHOW_ADSTRA_ADS === 'true' && (
                <>
                  <Script
                    id='adstra-invoke-profile'
                    strategy='lazyOnload'
                    src='//bunchhigher.com/34ad64cee096a6379cfbc810d1fc4a17/invoke.js'
                  />
                  <div
                    id='container-34ad64cee096a6379cfbc810d1fc4a17'
                    className='my-4'
                  />
                </>
              )}

              {/* no result */}
              {tab === 0 && userCreatedPosts?.length < 1 ? (
                <NoResult
                  title={
                    isCurrentUserProfile
                      ? 'Upload your first video'
                      : 'No uploaded videos yet!'
                  }
                  desc={
                    isCurrentUserProfile ? 'Your videos will appear here.' : ''
                  }
                />
              ) : tab === 1 && userLikedPosts?.length < 1 ? (
                <NoResult
                  title='No liked videos yet!'
                  desc={
                    isCurrentUserProfile
                      ? 'Videos you liked will appear here'
                      : ''
                  }
                />
              ) : (
                // videos
                <div className='mt-4 grid w-full grid-cols-2 place-items-stretch gap-x-3 gap-y-5 pb-4 max-[360px]:grid-cols-1 sm:grid-cols-auto-fill-180 xl:grid-cols-6'>
                  {tab === 0 ? (
                    <>
                      {userCreatedPosts?.map((post) => (
                        <VideoItem
                          key={post._id}
                          videoURL={post.video.asset.url}
                          likes={post.likes?.length || 0}
                          caption={post.caption}
                          videoId={post._id}
                          onVideoClick={keepScrollBeforeNavigate}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      {userLikedPosts?.map((post) => (
                        <VideoItem
                          key={post._id}
                          videoURL={post.video.asset.url}
                          likes={post.likes?.length || 0}
                          caption={post.caption}
                          videoId={post._id}
                          onVideoClick={keepScrollBeforeNavigate}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              {isClient && process.env.NEXT_SHOW_ADSTRA_ADS !== 'false' && (
                <>
                  <div className='fixed left-1/2 top-2 z-40 -translate-x-1/2'>
                    <div className='float-end h-[50px] w-[300px]'>
                      <InlineAd
                        adKey='446cc2bf6c736ad4493623200de984b7'
                        height={250}
                        width={320}
                      />
                    </div>
                  </div>
                  <div className='fixed right-0 top-1/2 z-40 -translate-x-1/2'>
                    <div className='h-[250px] w-[300px]'>
                      <InlineAd
                        adKey='771efbd0629abd37a6249d9c668dd549'
                        height={250}
                        width={300}
                      />
                    </div>
                  </div>
                  <div className='fixed bottom-2 left-1/2 z-40 -translate-x-1/2'>
                    <div className='h-[60px] w-[468px]'>
                      <InlineAd
                        adKey='db15771db06499df2dae745623193419'
                        height={60}
                        width={468}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export async function getServerSideProps({
  params: { id: userId },
}: {
  params: { id: string };
}) {
  const { data } = await axios.get(`${ROOT_URL}/api/user/${userId}`);

  return { props: { data } };
}

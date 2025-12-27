import axios from 'axios';
import Head from 'next/head';
import { ROOT_URL } from '../../utils';
import { Video } from '../../types';
import { RxCross2 } from 'react-icons/rx';
import { useRouter } from 'next/router';
import CommentSection from '../../components/commentSection';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import NoResult from '../../components/NoResult';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { GetServerSidePropsContext } from 'next';
import { AUTH_OPTIONS } from '../api/auth/[...nextauth]';
import useStore from '../../store';
import { InView } from 'react-intersection-observer';
import { IoMdHeart, IoMdPause } from 'react-icons/io';
import { IoPlay } from 'react-icons/io5';
import { HiVolumeOff, HiVolumeUp } from 'react-icons/hi';
import { motion } from 'framer-motion';
import { VideoFooter } from '../../components/videoItem/footer';
import NotLoginModal from '../../components/modal/NotLoginModal';
import DeleteModal from '../../components/modal/DeleteModal';
import { useSession } from 'next-auth/react';
import useLike from '../../hooks/useLike';
import useDeletePost from '../../hooks/useDeletePost';
import { videoClicker } from '../../utils/videoClick';
import { handleClickPosition } from '../../utils/handleClickPosition';

interface DetailProps {
  videoDetail: Video;
  origin: string;
}

export default function VideoDetail({ videoDetail, origin }: DetailProps) {
  const router = useRouter();
  const { setIsRestore } = useStore();
  const { data: user }: any = useSession();
  const { deletingPost, handleDeletePost } = useDeletePost();
  const { handleLike } = useLike();

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

  const [showLogin, setShowLogin] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);

  const [isMute, setIsMute] = useState(true);
  const [showPlayBtn, setShowPlayBtn] = useState(false);
  const [showPauseBtn, setShowPauseBtn] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  const [alreadyLiked, setAlreadyLiked] = useState<boolean>(
    !!videoDetail?.isLiked,
  );

  function handleMute(e: MouseEvent) {
    e.stopPropagation();
    setIsMute((prev) => !prev);
  }

  async function deletePostHandler() {
    await handleDeletePost(videoDetail._id);
    setShowDeletePostModal(false);
    router.push('/');
  }

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      setShowPlayBtn(false);
      setShowPauseBtn(true);
    } else {
      v.play();
      setShowPauseBtn(false);
      setShowPlayBtn(true);
    }
  }, []);

  const handleVideoSingleClick = useCallback(() => {
    handlePlayPause();
  }, [handlePlayPause]);

  const handleVideoDoubleClick = useCallback(
    async (e: MouseEvent) => {
      if (!user) return setShowLogin(true);
      setHeartPosition(handleClickPosition(e));
      setShowHeart(true);
      if (!alreadyLiked) {
        setAlreadyLiked(true);
        try {
          await handleLike({ userId: user._id, postId: videoDetail._id });
        } catch {
          setAlreadyLiked(false);
        }
      }
    },
    [alreadyLiked, handleLike, videoDetail._id, user],
  );

  const handleVideoClick = videoClicker(
    handleVideoSingleClick,
    handleVideoDoubleClick,
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
          {showLogin && <NotLoginModal onClose={() => setShowLogin(false)} />}
          {showDeletePostModal && (
            <DeleteModal
              onClose={() => setShowDeletePostModal(false)}
              deleteHandler={deletePostHandler}
              deleting={deletingPost}
              type='Post'
              text={videoDetail.caption}
            />
          )}
          <div className='flex w-full flex-col dark:bg-dark dark:text-white lg:min-h-screen lg:flex-row'>
            {/* left (video section styled like feed item) */}
            <div className='h-[480px] w-full bg-img-blur-light bg-cover bg-no-repeat object-cover dark:bg-img-blur-dark lg:h-screen lg:flex-1'>
              <div
                onClick={() => router.back()}
                title='back'
                className='absolute left-2 top-2 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#7e7b7b5e] text-white hover:bg-[#5c59595e] xs:flex'
              >
                <RxCross2 size={23} />
              </div>

              <InView
                as='div'
                threshold={0.5}
                initialInView={false}
                triggerOnce={false}
                onChange={() => {}}
                style={{
                  height:
                    'calc(100vh - 97px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                  scrollSnapStop: 'always',
                  scrollSnapAlign: 'start center',
                }}
                className='relative flex w-full flex-col items-center justify-center pb-[90px] sm:flex-row sm:pb-0'
              >
                <div
                  aria-label='video'
                  onClick={handleVideoClick}
                  className='group relative flex max-h-[calc(100vh-97px)] cursor-pointer items-center overflow-hidden rounded-2xl sm:h-full'
                >
                  {showHeart && (
                    <motion.div
                      className='pointer-events-none absolute text-5xl text-primary'
                      style={{ left: heartPosition.x, top: heartPosition.y }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        opacity: [0.7, 1, 0],
                        scale: [1, 1.5, 1],
                        rotate: [0, -20, 20, 0],
                      }}
                      transition={{ duration: 0.7 }}
                      onAnimationComplete={() => setShowHeart(false)}
                    >
                      <IoMdHeart />
                    </motion.div>
                  )}

                  <video
                    ref={videoRef}
                    src={videoDetail.video.asset.url}
                    loop
                    muted={isMute}
                    preload='metadata'
                    playsInline
                    onError={() => {
                      try {
                        const v = videoRef.current;
                        if (v) {
                          v.removeAttribute('src');
                        }
                      } catch {}
                    }}
                    className='video h-full w-full cursor-pointer object-cover object-center'
                  />

                  {showPlayBtn && (
                    <PlayPauseAniWrapper
                      onComplete={() => setShowPlayBtn(false)}
                    >
                      <IoPlay className='h-full w-full' />
                    </PlayPauseAniWrapper>
                  )}

                  {showPauseBtn && (
                    <PlayPauseAniWrapper
                      onComplete={() => setShowPauseBtn(false)}
                    >
                      <IoMdPause className='h-full w-full' />
                    </PlayPauseAniWrapper>
                  )}

                  <div className='action-btn-container absolute right-0 top-0 flex items-center justify-between p-4 text-white group-hover:flex'>
                    <>
                      {isMute ? (
                        <HiVolumeOff size={27} onClick={handleMute} />
                      ) : (
                        <HiVolumeUp size={27} onClick={handleMute} />
                      )}
                    </>
                  </div>

                  <VideoFooter
                    creator={videoDetail.postedBy}
                    caption={videoDetail.caption}
                    createdAt={videoDetail._createdAt!}
                  />
                </div>
              </InView>
            </div>
            {/* right */}
            <CommentSection videoDetail={videoDetail} />
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

type PlayPauseAniWrapperProps = {
  children: React.ReactNode;
  onComplete?: VoidFunction;
};
function PlayPauseAniWrapper({
  onComplete,
  children,
}: PlayPauseAniWrapperProps): JSX.Element {
  return (
    <motion.div
      className='absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-[#00000045] p-1 text-white'
      initial={{
        scale: 0,
        opacity: 0,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [1, 1.7, 0],
      }}
      onAnimationComplete={onComplete}
    >
      {children}
    </motion.div>
  );
}

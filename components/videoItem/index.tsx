import { Video } from '../../types';
import { IoMdHeart, IoMdPause } from 'react-icons/io';
import { IoPlay } from 'react-icons/io5';
import { HiVolumeOff, HiVolumeUp } from 'react-icons/hi';
import {
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useSession } from 'next-auth/react';
import useDeletePost from '../../hooks/useDeletePost';
import NotLoginModal from '../modal/NotLoginModal';
import DeleteModal from '../modal/DeleteModal';
import { useRouter } from 'next/router';
import Reaction from './Reaction';
import useStore from '../../store';
import { InView } from 'react-intersection-observer';
import { TIntersectingVideo } from '../../pages';
import useLike from '../../hooks/useLike';
import { videoClicker } from '../../utils/videoClick';
import { motion } from 'framer-motion';
import { handleClickPosition } from '../../utils/handleClickPosition';
import { VideoFooter } from './footer';
import CommentsBottomSheet from '../modal/CommentsBottomSheet';

interface Props {
  post: Video;
  isMute: boolean;
  handleMute(e: MouseEvent): void;
  handleIntersectingChange: (video: TIntersectingVideo) => void;
}

export default function VideoItem({
  post,
  isMute,
  handleMute,
  handleIntersectingChange,
}: Props) {
  const {
    _id: videoId,
    caption,
    video,
    isLiked: isLikedByCurrentUser,
    totalLikes: currentTotalLike,
    postedBy,
    _createdAt: videoCreatedAt,
  } = post;

  const [showLogin, setShowLogin] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [totalLikes, setTotalLikes] = useState(currentTotalLike);
  const [alreadyLiked, setAlreadyLiked] = useState(!!isLikedByCurrentUser);
  const [showPlayBtn, setShowPlayBtn] = useState(false);
  const [showPauseBtn, setShowPauseBtn] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // heart animation
  const [showHeart, setShowHeart] = useState(false);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const [isFastPlayback, setIsFastPlayback] = useState(false);

  //hooks
  const router = useRouter();
  const { data: user }: any = useSession();
  const { deletingPost, handleDeletePost } = useDeletePost();
  const { loading: liking, handleLike, handleUnlike } = useLike();
  const { currentVideo, setCurrentVideo } = useStore();

  const onIntersectingChange = (inView: boolean) => {
    handleIntersectingChange({ id: videoId, inView, videoRef });
  };

  async function deletePostHandler() {
    await handleDeletePost(videoId);

    setShowDeletePostModal(false);

    router.push('/');
  }

  const likeUnlikeHandler = useCallback(async () => {
    if (!user) return setShowLogin(true);

    const obj = { userId: user._id, postId: post._id };

    if (alreadyLiked) {
      try {
        setAlreadyLiked(false);
        setTotalLikes((prev) => prev - 1);
        await handleUnlike(obj);
      } catch (error) {
        setAlreadyLiked(true);
        setTotalLikes((prev) => prev + 1);
      }
    } else {
      try {
        setAlreadyLiked(true);
        setTotalLikes((prev) => prev + 1);
        await handleLike(obj);
      } catch (error) {
        setAlreadyLiked(false);
        setTotalLikes((prev) => prev - 1);
      }
    }
  }, [user, post._id, alreadyLiked, handleUnlike, handleLike]);

  const handlePlayPause = useCallback(() => {
    const video = currentVideo.videoRef?.current;
    if (!video) return;

    if (currentVideo.isPlaying) {
      video.pause();
      setCurrentVideo(videoRef, false);
      setShowPlayBtn(false);
      setShowPauseBtn(true);
    } else {
      video.play();
      setCurrentVideo(videoRef, true);
      setShowPauseBtn(false);
      setShowPlayBtn(true);
    }
  }, [currentVideo.isPlaying, currentVideo.videoRef, setCurrentVideo]);

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
        setTotalLikes((prev) => prev + 1);

        try {
          await handleLike({ userId: user._id, postId: post._id });
        } catch (error) {
          setAlreadyLiked(false);
          setTotalLikes((prev) => prev - 1);
        }
      }
    },
    [alreadyLiked, handleLike, post._id, user],
  );

  const handleVideoClick = videoClicker(
    handleVideoSingleClick,
    handleVideoDoubleClick,
  );

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    const bg = backgroundVideoRef.current;
    if (bg) bg.playbackRate = rate;
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    const bg = backgroundVideoRef.current;
    if (!v || !bg) return;

    const syncState = () => {
      bg.playbackRate = v.playbackRate;

      if (Math.abs(bg.currentTime - v.currentTime) > 0.3) {
        bg.currentTime = v.currentTime;
      }

      if (v.paused) {
        bg.pause();
      } else {
        bg.play().catch(() => {});
      }
    };

    const syncTime = () => {
      if (Math.abs(bg.currentTime - v.currentTime) > 0.3) {
        bg.currentTime = v.currentTime;
      }
    };

    const onPlay = () => {
      bg.play().catch(() => {});
    };
    const onPause = () => {
      bg.pause();
    };
    const onRateChange = () => {
      bg.playbackRate = v.playbackRate;
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ratechange', onRateChange);
    v.addEventListener('timeupdate', syncTime);
    v.addEventListener('seeking', syncTime);
    v.addEventListener('seeked', syncTime);

    syncState();

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ratechange', onRateChange);
      v.removeEventListener('timeupdate', syncTime);
      v.removeEventListener('seeking', syncTime);
      v.removeEventListener('seeked', syncTime);
    };
  }, []);

  const handleLongPressStart = useCallback(
    (e: ReactPointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.action-btn-container')) return;

      if (e.pointerType === 'mouse' && (e.buttons ?? 1) !== 1) return;

      clearLongPressTimer();
      longPressTimeoutRef.current = window.setTimeout(() => {
        setIsFastPlayback(true);
        setPlaybackRate(2);
      }, 300);
    },
    [clearLongPressTimer, setPlaybackRate],
  );

  const handleLongPressEnd = useCallback(() => {
    clearLongPressTimer();

    if (!isFastPlayback) return;
    setIsFastPlayback(false);
    setPlaybackRate(1);
  }, [clearLongPressTimer, isFastPlayback, setPlaybackRate]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      setPlaybackRate(1);
    };
  }, [clearLongPressTimer, setPlaybackRate]);

  return (
    <>
      {showLogin && <NotLoginModal onClose={() => setShowLogin(false)} />}
      {showDeletePostModal && (
        <DeleteModal
          onClose={() => setShowDeletePostModal(false)}
          deleteHandler={deletePostHandler}
          deleting={deletingPost}
          type='Post'
          text={caption}
        />
      )}

      <InView
        as='div'
        threshold={0.5}
        initialInView={false}
        triggerOnce={false}
        onChange={onIntersectingChange}
        style={{
          height:
            'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
          scrollSnapStop: 'always',
          scrollSnapAlign: 'start center',
        }}
        className='relative flex w-full flex-col items-center justify-center pb-0 sm:flex-row'
      >
        <div
          aria-label='video'
          onClick={handleVideoClick}
          onPointerDown={handleLongPressStart}
          onPointerUp={handleLongPressEnd}
          onPointerCancel={handleLongPressEnd}
          onPointerLeave={handleLongPressEnd}
          onContextMenu={(e) => e.preventDefault()}
          className='rounded-0 group relative isolate flex h-full w-full cursor-pointer items-center justify-center overflow-hidden bg-black sm:h-full sm:rounded-2xl'
        >
          <video
            ref={backgroundVideoRef}
            aria-hidden
            tabIndex={-1}
            src={video.asset.url}
            loop
            muted
            preload='metadata'
            playsInline
            className='pointer-events-none absolute inset-0 z-0 h-full w-full scale-110 object-cover object-center opacity-60 blur-2xl sm:hidden'
          />

          <div className='pointer-events-none absolute inset-0 z-0 bg-black/20 sm:hidden' />

          {showHeart && (
            <motion.div
              className='pointer-events-none absolute z-30 text-5xl text-primary'
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
            src={video.asset.url}
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
              } catch (_) {}
            }}
            className='video relative z-10 h-full w-full cursor-pointer object-contain object-center sm:object-cover'
          />

          {showPlayBtn && (
            <PlayPauseAniWrapper onComplete={() => setShowPlayBtn(false)}>
              <IoPlay className='h-full w-full' />
            </PlayPauseAniWrapper>
          )}

          {showPauseBtn && (
            <PlayPauseAniWrapper onComplete={() => setShowPauseBtn(false)}>
              <IoMdPause className='h-full w-full' />
            </PlayPauseAniWrapper>
          )}

          <div className='action-btn-container z-2000 absolute left-1/2 top-0 flex -translate-x-1/2 items-center justify-between p-4 text-white group-hover:flex sm:left-auto sm:right-0 sm:translate-x-0'>
            <>
              {isMute ? (
                <HiVolumeOff size={27} onClick={handleMute} />
              ) : (
                <HiVolumeUp size={27} onClick={handleMute} />
              )}
            </>
          </div>

          <VideoFooter
            creator={postedBy}
            caption={caption}
            createdAt={videoCreatedAt!}
          />
          {showComments && (
            <div className='hidden sm:block'>
              <CommentsBottomSheet
                isOpen={showComments}
                onClose={() => setShowComments(false)}
                videoDetail={post}
              />
            </div>
          )}
        </div>
        {showComments && (
          <div className='sm:hidden'>
            <CommentsBottomSheet
              isOpen={showComments}
              onClose={() => setShowComments(false)}
              videoDetail={post}
            />
          </div>
        )}
        <Reaction
          totalLikes={totalLikes}
          likeUnlikeHandler={likeUnlikeHandler}
          isAlreadyLike={alreadyLiked}
          video={post}
          liking={liking}
          setShowLoginModal={setShowLogin}
          setShowDeleteModal={setShowDeletePostModal}
          onShowComments={() => setShowComments(true)}
        />
      </InView>
    </>
  );
}

type PlayPauseAniWrapperProps = {
  children: ReactNode;
  onComplete?: VoidFunction;
};
function PlayPauseAniWrapper({
  onComplete,
  children,
}: PlayPauseAniWrapperProps): JSX.Element {
  return (
    <motion.div
      className='absolute left-1/2 top-1/2 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#00000045] p-1 text-white'
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

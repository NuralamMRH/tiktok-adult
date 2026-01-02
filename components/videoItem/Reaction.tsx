import Image from 'next/image';
import Link from 'next/link';
import {
  IoIosCopy,
  IoMdCheckmark,
  IoMdDownload,
  IoMdShareAlt,
} from 'react-icons/io';
import { nativeShareVia, shareVia } from '../../utils/shareVia';
import { socialIcons } from '../../utils/constants';
import useCopy from '../../hooks/useCopy';
import { BsHeartFill } from 'react-icons/bs';
import { RiMessage2Fill } from 'react-icons/ri';
import useCheckTouchDevice from '../../hooks/useCheckTouchDevice';
import { Video } from '../../types';
import { ROOT_URL } from '../../utils';
import millify from 'millify';
import { AiOutlinePlus } from 'react-icons/ai';
import { PiSpinnerGap } from 'react-icons/pi';
import { HiVolumeOff, HiVolumeUp } from 'react-icons/hi';

import {
  Dispatch,
  MouseEvent,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import { MdDelete } from 'react-icons/md';
import { useSession } from 'next-auth/react';
import useStore from '../../store';
import useFollow from '../../hooks/useFollow';
import { useSetPrevScroll } from '../../hooks/usePrevScroll';

interface Props {
  totalLikes: number;
  video: Video;
  likeUnlikeHandler: () => Promise<void>;
  isAlreadyLike: boolean;
  liking: boolean;
  isMute: boolean;
  handleMute: (e: MouseEvent) => void;
  setShowLoginModal: Dispatch<SetStateAction<boolean>>;
  setShowDeleteModal: Dispatch<SetStateAction<boolean>>;
  onShowComments?: () => void;
  onActionIntercept: () => boolean;
}

interface ShareLinkProps {
  src: string;
  name: string;
  POST_URL: string;
  caption: string;
  onClick?: () => void;
}

type FFmpegProgressEvent = {
  progress: number;
};

let ffmpegLoadPromise: Promise<unknown> | null = null;
let ffmpegInstance: unknown | null = null;

async function getFFmpeg(onProgress?: (progress: number) => void) {
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg can only run in the browser.');
  }

  if (ffmpegInstance) return ffmpegInstance as any;

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);

      const ffmpeg = new FFmpeg();

      const baseURL =
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            'text/javascript',
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            'application/wasm',
          ),
        });
      } catch {
        const fallbackBaseURL =
          'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${fallbackBaseURL}/ffmpeg-core.js`,
            'text/javascript',
          ),
          wasmURL: await toBlobURL(
            `${fallbackBaseURL}/ffmpeg-core.wasm`,
            'application/wasm',
          ),
        });
      }

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }

  let ffmpeg: any;
  try {
    ffmpeg = (await ffmpegLoadPromise) as any;
  } catch (e) {
    ffmpegLoadPromise = null;
    ffmpegInstance = null;
    throw e;
  }

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }: FFmpegProgressEvent) => {
      if (typeof progress === 'number') onProgress(progress);
    });
  }

  return ffmpeg;
}

function ShareLink({ src, name, POST_URL, caption, onClick }: ShareLinkProps) {
  return (
    <Link
      target='_blank'
      href={shareVia(name, POST_URL, caption)!}
      onClick={(e) => {
        if (onClick && onClick()) {
          e.preventDefault();
        }
      }}
      className='flex cursor-pointer items-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-darkBtnHover'
    >
      <Image
        src={src}
        alt='social_icon'
        width={30}
        height={30}
        className='mr-2 h-7 w-7 cursor-pointer'
      />
      <p className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
        Share to {name}
      </p>
    </Link>
  );
}

export default function Reaction({
  totalLikes,
  video,
  likeUnlikeHandler,
  isAlreadyLike,
  liking,
  isMute,
  handleMute,
  setShowLoginModal,
  setShowDeleteModal,
  onShowComments,
  onActionIntercept,
}: Props) {
  const { postedBy } = video;

  const [isCreator, setIsCreator] = useState(false);
  const [alreadyFollow, setAlreadyFollow] = useState(!!postedBy.isFollowed);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: user }: any = useSession();
  const { isCopied, copyToClipboard } = useCopy();
  const { isTouchDevice } = useCheckTouchDevice();
  const { handleFollow, handleUnFollow } = useFollow();

  const {
    followLoadingIds,
    currentFollowedUserIds,
    currentUnFollowedUserIds,
    videoContainerRef,
    setFollowLoadingId,
    removeFollowLoadingId,
    setCurrentFollowedUserIds,
    removeCurrentFollowedUserIds,
    setCurrentUnFollowedUserIds,
    removeCurrentUnFollowedUserIds,
  } = useStore();
  const { keepScrollBeforeNavigate } = useSetPrevScroll(videoContainerRef!);

  const followLoading = followLoadingIds.includes(postedBy._id);

  useEffect(() => {
    setIsCreator(postedBy._id === user?._id);
  }, [user, postedBy._id]);

  const POST_URL = `${ROOT_URL}/video/${video._id}`;

  function sanitizeUrl(u: string) {
    if (!u) return '';
    const s = u.trim().replace(/[)]+$/g, '');
    if (s.includes('images.pexels.com/')) return '/blur-img-light.jpg';
    return s;
  }

  async function downloadHandler(e: MouseEvent) {
    e.stopPropagation();
    if (onActionIntercept()) return;

    if (isDownloading) return;

    setIsDownloading(true);

    let ffmpeg: any;
    try {
      const { fetchFile } = await import('@ffmpeg/util');
      ffmpeg = await getFFmpeg();

      const inputUrl = video.video.asset.url;
      const outputName = `video-${video._id}.mp4`;

      await ffmpeg.writeFile('input.mp4', await fetchFile(inputUrl));
      await ffmpeg.writeFile('logo.png', await fetchFile('/logo.png'));
      await ffmpeg.writeFile('outro.mp4', await fetchFile('/logo-video.mp4'));

      const watermarkGraph = [
        '[1:v][0:v]scale2ref=w=main_w*0.18:h=-1[logo][base]',
        '[logo]split=2[logo1][logo2]',
        '[base][logo1]overlay=10:10[tmp]',
        '[tmp][logo2]overlay=10:H-h-10[outv]',
      ].join(';');

      await ffmpeg.exec([
        '-i',
        'input.mp4',
        '-i',
        'logo.png',
        '-filter_complex',
        watermarkGraph,
        '-map',
        '[outv]',
        '-map',
        '0:a?',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        'watermarked.mp4',
      ]);

      const concatGraph = [
        '[1:v][0:v]scale2ref=w=main_w:h=main_h[outroScaled][wmBase]',
        '[wmBase]setsar=1[v0]',
        '[outroScaled]setsar=1[v1]',
        '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a0]',
        '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]',
      ].join(';');

      try {
        await ffmpeg.exec([
          '-i',
          'watermarked.mp4',
          '-i',
          'outro.mp4',
          '-filter_complex',
          concatGraph,
          '-map',
          '[outv]',
          '-map',
          '[outa]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-movflags',
          '+faststart',
          'output.mp4',
        ]);
      } catch {
        const concatVideoOnlyGraph = [
          '[1:v][0:v]scale2ref=w=main_w:h=main_h[outroScaled][wmBase]',
          '[wmBase]setsar=1[v0]',
          '[outroScaled]setsar=1[v1]',
          '[v0][v1]concat=n=2:v=1:a=0[outv]',
        ].join(';');

        await ffmpeg.exec([
          '-i',
          'watermarked.mp4',
          '-i',
          'outro.mp4',
          '-filter_complex',
          concatVideoOnlyGraph,
          '-map',
          '[outv]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-movflags',
          '+faststart',
          'output.mp4',
        ]);
      }

      const outputData = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
      const outputBytes = new Uint8Array(outputData);
      const blob = new Blob([outputBytes], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = outputName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
    } finally {
      try {
        if (ffmpeg) {
          await Promise.allSettled([
            ffmpeg.deleteFile('input.mp4'),
            ffmpeg.deleteFile('logo.png'),
            ffmpeg.deleteFile('outro.mp4'),
            ffmpeg.deleteFile('watermarked.mp4'),
            ffmpeg.deleteFile('output.mp4'),
          ]);
        }
      } catch {}

      setIsDownloading(false);
    }
  }

  async function followHandler(e: MouseEvent) {
    e.stopPropagation();
    if (onActionIntercept()) return;

    if (!user) return setShowLoginModal(true);

    const obj = { userId: user._id, creatorId: postedBy?._id };

    setFollowLoadingId(obj.creatorId);

    if (alreadyFollow) {
      await handleUnFollow(obj);

      removeFollowLoadingId(obj.creatorId);
      setCurrentUnFollowedUserIds(obj.creatorId);
      removeCurrentFollowedUserIds(obj.creatorId);
    } else {
      await handleFollow(obj);

      removeFollowLoadingId(obj.creatorId);
      setCurrentFollowedUserIds(obj.creatorId);
      removeCurrentUnFollowedUserIds(obj.creatorId);
    }
  }

  // check already follow or not
  useEffect(() => {
    const isCurrentlyFollow = currentFollowedUserIds.includes(postedBy._id);
    const isCurrentlyUnFollow = currentUnFollowedUserIds.includes(postedBy._id);

    if (postedBy.isFollowed && !isCurrentlyUnFollow) {
      setAlreadyFollow(true);
    } else if (!postedBy.isFollowed && isCurrentlyFollow) {
      setAlreadyFollow(true);
    } else {
      setAlreadyFollow(false);
    }
  }, [
    currentFollowedUserIds,
    currentUnFollowedUserIds,
    postedBy._id,
    postedBy.isFollowed,
  ]);

  return (
    <div className='absolute bottom-2 right-0 flex select-none flex-col items-center justify-end gap-3 sm:static sm:ml-4 sm:h-full sm:w-12 sm:max-w-[unset] sm:flex-col sm:flex-nowrap sm:items-start sm:justify-end'>
      {/* follow or delete */}
      {isCreator ? (
        <div className='flex flex-col items-center'>
          <button
            onClick={() => {
              if (onActionIntercept()) return;
              setShowDeleteModal(true);
            }}
            className={`reaction-btn mb-2`}
          >
            <MdDelete size={25} color='red' />
          </button>
        </div>
      ) : (
        <div className='relative mb-4'>
          <Link
            onClick={(e) => {
              if (onActionIntercept()) {
                e.preventDefault();
                return;
              }
              keepScrollBeforeNavigate();
            }}
            href={`/profile/${postedBy._id}`}
            className='flex h-14 w-14 flex-col items-center overflow-hidden rounded-full'
          >
            <Image
              src={sanitizeUrl(postedBy.image)}
              alt='user avatar'
              className='h-full w-full bg-gray-200 object-cover dark:bg-[#7e7b7b5e]'
              width={60}
              height={60}
            />
          </Link>

          {alreadyFollow ? (
            <button
              onClick={followHandler}
              disabled={followLoading}
              className='absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-none bg-gray-100 outline-none'
            >
              {followLoading ? (
                <PiSpinnerGap className='animate-spin' />
              ) : (
                <IoMdCheckmark className='font-bold text-primary' />
              )}
            </button>
          ) : (
            <button
              onClick={followHandler}
              disabled={followLoading}
              className='absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-none bg-primary outline-none'
            >
              {followLoading ? (
                <PiSpinnerGap className='animate-spin text-white' />
              ) : (
                <AiOutlinePlus className='text-white' />
              )}
            </button>
          )}
        </div>
      )}

      {/* like */}
      <div className='flex flex-col items-center'>
        <button
          onClick={() => {
            if (onActionIntercept()) return;
            likeUnlikeHandler();
          }}
          disabled={liking}
          className={`reaction-btn ${
            isAlreadyLike ? 'text-primary dark:text-primary' : ''
          }`}
        >
          <BsHeartFill size={22} />
        </button>
        <p className='mt-1 text-sm'>{millify(totalLikes || 0)}</p>
      </div>

      {/* comment */}
      <div className='flex flex-col items-center'>
        <button
          className='reaction-btn'
          onClick={() => {
            if (onActionIntercept()) return;
            onShowComments && onShowComments();
          }}
          aria-label='show-comments'
        >
          <RiMessage2Fill size={22} />
        </button>
        <p className='mt-1 text-sm'>{millify(video.comments?.length || 0)}</p>
      </div>

      {/* sound */}
      <div className='flex flex-col items-center'>
        <button
          className='reaction-btn'
          onClick={(e) => {
            if (onActionIntercept()) return;
            handleMute(e);
          }}
          aria-label='toggle-sound'
        >
          {isMute ? <HiVolumeOff size={22} /> : <HiVolumeUp size={22} />}
        </button>
      </div>

      {/* download */}
      <div className='flex flex-col items-center'>
        <button
          className='reaction-btn'
          onClick={downloadHandler}
          aria-label='download-video'
          disabled={isDownloading}
        >
          {isDownloading ? (
            <PiSpinnerGap className='animate-spin' size={22} />
          ) : (
            <IoMdDownload size={24} />
          )}
        </button>
      </div>

      {/* share */}
      {isTouchDevice ? (
        <button
          className='reaction-btn'
          onClick={() => {
            if (onActionIntercept()) return;
            nativeShareVia(video.caption, POST_URL);
          }}
        >
          <IoMdShareAlt size={28} />
        </button>
      ) : (
        <div className='group relative'>
          <button
            className='reaction-btn'
            onClick={() => {
              if (onActionIntercept()) return;
            }}
          >
            <IoMdShareAlt size={28} />
          </button>

          <div className='absolute bottom-16 right-0 hidden w-[240px] group-hover:block xl:-left-3'>
            <div className='rounded-md border border-gray-200 bg-slate-100 dark:border-darkBorder dark:bg-darkSecondary'>
              {socialIcons.map((item) => (
                <ShareLink
                  key={item.name}
                  src={item.icon}
                  name={item.name}
                  POST_URL={POST_URL}
                  caption={video.caption}
                  onClick={() => onActionIntercept() as unknown as void}
                />
              ))}

              <div
                onClick={() => {
                  if (onActionIntercept()) return;
                  copyToClipboard(POST_URL);
                }}
                className='flex cursor-pointer items-center px-4 py-2 hover:bg-gray-200 dark:hover:bg-darkBtnHover'
              >
                <div className='mr-2 flex h-7 w-7 items-center justify-center'>
                  <IoIosCopy size={25} />
                </div>
                <p className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
                  {isCopied ? 'Copied' : 'Copy link'}
                </p>
              </div>
            </div>

            <div className='mt-3' />
          </div>

          <p className='mt-1 text-center text-xs text-gray-600 dark:text-gray-200'>
            Share
          </p>
        </div>
      )}
    </div>
  );
}

import { MouseEvent, useEffect, useRef, useState } from 'react';
import { useCheckOverflow } from '../../hooks/useCheckOverflow';
import { formatDate } from '../../utils/formatDate';
import Link from 'next/link';
import { Video } from '../../types';

type Props = {
  creator: Video['postedBy'];
  caption: string;
  createdAt: string | Date;
};

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

export function VideoFooter({ creator, caption, createdAt }: Props) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const { ref: textRef, isOverflow: isTextOverflow } =
    useCheckOverflow<HTMLDivElement>();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const toggleTextExpend = (e: MouseEvent) => {
    e.stopPropagation();

    setIsTextExpanded((prev) => !prev);
  };

  return (
    <div className='video-overlay-bg absolute bottom-0 left-0 z-20 w-full space-y-1 px-4 pb-0 text-sm text-white'>
      <p className='opacity-90'>
        <Link
          onClick={(e) => e.stopPropagation()}
          href={`/profile/${creator._id}`}
          className='font-bold hover:underline'
        >
          {creator.userName}
        </Link>{' '}
        •{' '}
        <span className='text-xs italic' suppressHydrationWarning>
          {formatDate(createdAt)}
        </span>
      </p>

      <div
        className={`${isTextExpanded ? 'pb-7' : 'gap-4'} relative flex items-center justify-between opacity-90 transition-all`}
      >
        <p ref={textRef} className={`${isTextExpanded ? '' : 'line-clamp-1'}`}>
          {caption}
        </p>

        {isTextOverflow && (
          <button onClick={toggleTextExpend} className='text-nowrap px-2 py-1'>
            more
          </button>
        )}

        {isTextExpanded && (
          <button
            onClick={toggleTextExpend}
            className='absolute bottom-0 right-0 ml-auto text-nowrap px-2 py-1'
          >
            less
          </button>
        )}
      </div>

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
  );
}

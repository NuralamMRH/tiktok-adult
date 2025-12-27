import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { ROOT_URL } from '../utils';

interface CaptionProp {
  caption: string;
  count: number;
}

function CaptionItem({ caption }: { caption: string }) {
  const router = useRouter();
  const activeCaption = router.query.caption;

  const clickCaptionHandler = (captionText: string) =>
    router.push(`/?caption=${encodeURIComponent(captionText)}`);

  return (
    <button
      aria-label={caption}
      onClick={() => clickCaptionHandler(caption)}
      key={caption}
      className={`${
        caption === activeCaption
          ? 'active-topic'
          : 'border-gray-200 bg-gray-100 text-gray-800 hover:border-gray-300 hover:bg-gray-200 dark:bg-darkBtn dark:text-gray-200 dark:hover:bg-darkBtnHover'
      } flex items-center justify-center rounded-full border px-2 py-1 text-[10px] dark:border-darkSecondary sm:px-3 sm:py-2 sm:text-sm`}
    >
      <p className='ml-2'>{caption}</p>
    </button>
  );
}

export default function PopularTopics() {
  const [captions, setCaptions] = useState<CaptionProp[]>([]);

  useEffect(() => {
    let mounted = true;
    axios
      .get(`${ROOT_URL}/api/caption?limit=100`)
      .then((res) => {
        if (!mounted) return;
        setCaptions(res.data);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className='mb-2'>
      <h2 className='mb-3 font-semibold text-gray-500 dark:text-gray-400'>
        Popular Captions
      </h2>

      <div className='flex flex-wrap gap-2'>
        {captions.map((c) => (
          <CaptionItem key={c.caption} caption={c.caption} />
        ))}
      </div>
    </div>
  );
}

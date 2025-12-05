import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { useState } from 'react';
import CommentSection from '../commentSection';
import { Video } from '../../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  videoDetail: Video;
};

export default function CommentsBottomSheet({
  isOpen,
  onClose,
  videoDetail,
}: Props) {
  const [isFull, setIsFull] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [baseHeight, setBaseHeight] = useState<number>(0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.25 }}
          drag='y'
          dragElastic={0.08}
          dragMomentum={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragStart={() => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
            setBaseHeight(isFull ? vh : vh * 0.6);
          }}
          onDrag={(_, info: PanInfo) => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
            const candidate = baseHeight - info.offset.y;
            const minH = vh * 0.4;
            const maxH = vh;
            const clamped = Math.max(minH, Math.min(maxH, candidate));
            setDragHeight(clamped);
          }}
          onDragEnd={(_, info: PanInfo) => {
            if (info.offset.y > 120) onClose();
            else if (
              info.offset.y < -120 ||
              (dragHeight ?? 0) >
                (typeof window !== 'undefined' ? window.innerHeight * 0.9 : 0)
            )
              setIsFull(true);
            else setIsFull(false);
            setDragHeight(null);
          }}
          className={`absolute bottom-0 left-0 z-20 w-full rounded-t-2xl bg-white shadow-lg dark:bg-darkSecondary`}
          style={{
            touchAction: 'none',
            height: dragHeight ?? (isFull ? '100vh' : '60vh'),
            y: 0,
          }}
        >
          <div className='flex w-full justify-center pt-2'>
            <div className='h-1.5 w-10 rounded-full bg-gray-300 dark:bg-darkBorder' />
          </div>

          <CommentSection videoDetail={videoDetail} showHeader={false} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

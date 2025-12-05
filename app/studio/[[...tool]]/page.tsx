import { NextStudio } from 'next-sanity/studio';
import config from '../../../sanity.config';

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  if (process.env.NODE_ENV === 'production') return null;
  return <NextStudio config={config} />;
}

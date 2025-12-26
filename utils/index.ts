export const ROOT_URL =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_ROOT_URL || 'http://xxxdeshi.xyz/'
    : '';

import type { IncomingMessage } from 'http';

export const ROOT_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_ROOT_URL ||
        process.env.NEXTAUTH_URL ||
        'http://xxxdeshi.xyz/').replace(/\/+$/, '')
    : '';

export function getRequestOrigin(req?: IncomingMessage) {
  const xfProto = req?.headers?.['x-forwarded-proto'];
  const xfHost = req?.headers?.['x-forwarded-host'];

  const proto = (Array.isArray(xfProto) ? xfProto[0] : xfProto || '')
    .split(',')[0]
    .trim();
  const host = (
    (Array.isArray(xfHost) ? xfHost[0] : xfHost) ||
    req?.headers?.host ||
    ''
  )
    .split(',')[0]
    .trim();

  if (host) return `${proto || 'http'}://${host}`.replace(/\/+$/, '');
  return ROOT_URL || 'http://localhost:3000';
}

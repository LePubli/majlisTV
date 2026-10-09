// Jeton de lecture court (HMAC) : autorise la lecture des playlists HLS d'une conférence précise.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

const sign = (talkId, exp) =>
  createHmac('sha256', config.jwtSecret).update(`play:${talkId}:${exp}`).digest('base64url');

export function makePlaybackToken(talkId, ttlSeconds = 6 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${sign(talkId, exp)}`;
}

export function checkPlaybackToken(talkId, token) {
  if (typeof token !== 'string') return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(talkId, exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

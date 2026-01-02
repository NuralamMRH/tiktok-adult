const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('next-sanity');

function loadDotEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    raw.split(/\r?\n/).forEach((line) => {
      const s = (line || '').trim();
      if (!s || s.startsWith('#')) return;
      const m = s.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) return;
      const key = m[1];
      let val = m[2] || '';
      if (
        val.length >= 2 &&
        ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'")))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    });
  } catch (_) {}
}

const root = path.resolve(__dirname, '..');
loadDotEnv(path.join(root, 'scripts', '.env'));
loadDotEnv(path.join(root, '.env.local'));
loadDotEnv(path.join(root, '.env'));

function pickEnv(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

const defaultProjectId = pickEnv(
  'NEXT_PUBLIC_SANITY_PROJECT_ID',
  'SANITY_PROJECT_ID',
  'SANITY_STUDIO_PROJECT_ID',
);
const defaultDataset =
  pickEnv(
    'NEXT_PUBLIC_SANITY_DATASET',
    'SANITY_DATASET',
    'SANITY_STUDIO_DATASET',
  ) || 'production';
const defaultApiVersion =
  pickEnv('NEXT_PUBLIC_SANITY_API_VERSION', 'SANITY_API_VERSION') ||
  '2023-11-11';
const defaultToken = pickEnv(
  'NEXT_PUBLIC_SANITY_TOKEN',
  'SANITY_TOKEN',
  'SANITY_API_TOKEN',
  'SANITY_WRITE_TOKEN',
);

const detailsFile = path.join(root, 'python-scraper', 'post-details.json');

function clean(s) {
  if (!s) return '';
  return String(s)
    .replace(/\s*–?\s*MmsBaba\.Com\s*$/i, '')
    .trim();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomInt(min, max) {
  const a = Number(min);
  const b = Number(max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function pickLikeCount() {
  const r = Math.random();
  if (r < 0.5) return randomInt(900, 20_000);
  if (r < 0.85) return randomInt(20_001, 200_000);
  if (r < 0.97) return randomInt(200_001, 2_000_000);
  return randomInt(2_000_001, 10_000_000);
}

function pickCommentCountFromLikes(likeCount) {
  const like = Math.max(0, Number(likeCount) || 0);
  const r = Math.random();
  if (r < 0.15) return randomInt(0, 15);
  if (r < 0.35) return randomInt(10, 220);
  const ratio = 0.03 + Math.random() * (0.5 - 0.03);
  const raw = Math.floor(like * ratio);
  return clampInt(raw, 0, 2000);
}

async function readDetails(filePath = detailsFile) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  return Array.isArray(json.posts) ? json.posts : [];
}

function buildClient({ projectId, dataset, apiVersion, token }) {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    ignoreBrowserTokenWarning: true,
  });
}

function safeOrigin(u) {
  try {
    return new URL(String(u)).origin;
  } catch (_) {
    return '';
  }
}

function safeHost(u) {
  try {
    return new URL(String(u)).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
}

function pickScraperInternalUrl() {
  const raw =
    pickEnv('SCRAPER_INTERNAL_URL') ||
    pickEnv('NEXT_PUBLIC_SCRAPER_INTERNAL_URL') ||
    '';
  return raw.trim() || 'http://localhost:4000';
}

function pickRefererForUrl(videoUrl, referer) {
  const vHost = safeHost(videoUrl);
  const rHost = safeHost(referer);
  if (vHost && rHost && vHost === rHost) return String(referer || '').trim();
  return safeOrigin(videoUrl) || '';
}

function buildVideoFetchHeaders({ videoUrl, referer }) {
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
  };
  const r = String(referer || '').trim();
  if (r) headers.referer = r;
  const origin = safeOrigin(videoUrl);
  if (origin) headers.origin = origin;
  return headers;
}

async function fetchVideoBuffer(url, referer) {
  const videoUrl = String(url || '');
  const internal = pickScraperInternalUrl();
  const ref = String(referer || '').trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    if (internal) {
      const proxyUrl = new URL('/api/media', internal);
      proxyUrl.searchParams.set('url', videoUrl);
      if (ref) proxyUrl.searchParams.set('referer', ref);
      try {
        const pr = await fetch(String(proxyUrl), {
          redirect: 'follow',
          signal: controller.signal,
        });
        if (!pr.ok) throw new Error(`proxy fetch failed ${pr.status}`);
        const buf = await pr.arrayBuffer();
        const contentType = pr.headers.get('content-type') || 'video/mp4';
        return { buf, contentType };
      } catch (e) {
        if (e.name === 'AbortError') throw new Error('video fetch timeout');
      }
    }

    const res = await fetch(videoUrl, {
      redirect: 'follow',
      headers: buildVideoFetchHeaders({ videoUrl, referer: ref }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`video fetch failed ${res.status}`);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'video/mp4';
    return { buf, contentType };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadVideoAsset(client, url, { referer } = {}) {
  let payload = null;
  try {
    payload = await fetchVideoBuffer(url, pickRefererForUrl(url, referer));
  } catch (e1) {
    const msg = String(e1?.message || '');
    // Don't retry on 404 or timeout
    if (msg.includes('404') || msg.includes('timeout')) throw e1;

    const fallbackRef = safeOrigin(url);
    const originalRef = String(referer || '').trim();
    if (fallbackRef && fallbackRef !== originalRef) {
      payload = await fetchVideoBuffer(url, fallbackRef);
    } else {
      throw e1;
    }
  }
  const filename =
    path.basename(String(url).split('?')[0]) || `video-${randomId()}.mp4`;
  const body = Buffer.from(payload.buf);
  return await client.assets.upload('file', body, {
    filename,
    contentType: payload.contentType,
  });
}

async function findExistingPost(client, sourceLink) {
  if (!sourceLink) return null;
  const q = '*[_type=="post" && sourceLink==$sourceLink][0]{_id}';
  return (await client.fetch(q, { sourceLink })) || null;
}

function postIdForSourceLink(sourceLink) {
  if (!sourceLink) return `post-${randomId()}`;
  const h = crypto.createHash('sha1').update(String(sourceLink)).digest('hex');
  return `post-${h}`;
}

const USER_IMAGES = [
  'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg',
  'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
  'https://images.pexels.com/photos/3617555/pexels-photo-3617555.jpeg',
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
  'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg',
  'https://images.pexels.com/photos/936064/pexels-photo-936064.jpeg',
  'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg',
];

const USER_NAME_SEEDS = [
  'Riya Ray',
  'Riya Noor',
  'Riya Bloom',
  'Riya Rose',
  'Riya Sky',
  'Riya Moon',
  'Riya Star',
  'Riya Glow',
  'Riya Pearl',
  'Riya Soft',
  'Piya Ray',
  'Piya Noor',
  'Piya Bloom',
  'Piya Rose',
  'Piya Sky',
  'Piya Moon',
  'Piya Star',
  'Piya Glow',
  'Piya Pearl',
  'Piya Soft',
];

async function ensureUsers(client, names) {
  const users = [];
  for (const name of names) {
    const q = '*[_type=="user" && userName==$name][0]{_id,userName,image}';
    let u = await client.fetch(q, { name });
    if (!u) {
      const id = `user-${randomId()}`;
      const img = pick(USER_IMAGES);
      const followerCount = Math.floor(Math.random() * 5_000_000) + 1;
      await client.createIfNotExists({
        _id: id,
        _type: 'user',
        userName: name,
        image: img,
        bio: 'Creator',
        followerCount,
      });
      u = { _id: id, userName: name, image: img };
    }
    users.push(u);
  }
  return users;
}

function wordsFromText(input) {
  const s = String(input || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase();
  const raw = s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'you',
    'your',
    'are',
    'was',
    'were',
    'from',
    'into',
    'just',
    'have',
    'has',
    'had',
    'more',
    'very',
    'like',
    'love',
    'nice',
    'today',
    'video',
    'post',
    'watch',
  ]);
  const out = [];
  const seen = new Set();
  for (const w of raw) {
    if (w.length < 4) continue;
    if (stop.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function pickKeyword(post) {
  const desc =
    post?.meta_description ||
    post?.og_description ||
    post?.description ||
    post?.caption ||
    post?.title ||
    '';
  const words = wordsFromText(desc);
  return words.length ? pick(words) : '';
}

function pickTags(post) {
  const tags = Array.isArray(post?.slinks_texts)
    ? post.slinks_texts
    : Array.isArray(post?.tags)
      ? post.tags
      : [];
  const cleaned = tags
    .map((t) =>
      String(t || '')
        .replace(/^#/, '')
        .trim(),
    )
    .filter(Boolean);
  const uniq = Array.from(new Set(cleaned));
  if (!uniq.length) return [];
  if (uniq.length === 1) return [uniq[0]];
  if (Math.random() < 0.7) return [pick(uniq)];
  const a = pick(uniq);
  let b = pick(uniq);
  for (let i = 0; i < 5 && b === a; i++) b = pick(uniq);
  return b === a ? [a] : [a, b];
}

function randomTimestamp() {
  const mm = randomInt(0, 1) === 0 ? 0 : randomInt(0, 2);
  const ss = randomInt(3, 57);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function pickEmoji() {
  const sets = [
    ['🔥', '✨', '😍'],
    ['💯', '👏', '🙌'],
    ['🤯', '😮', '😅'],
    ['🖤', '🤍', '💖'],
    ['😈', '🥵', '😏'],
  ];
  return pick(pick(sets));
}

function buildCommentText(post) {
  const keyword = pickKeyword(post);
  const tags = pickTags(post);
  const ts = randomTimestamp();
  const caption = clean(post?.title || post?.caption || '');
  const emoji = pickEmoji();

  const descriptionTemplates = [
    `I've been looking for more ${keyword || 'content'} like this. Amazing! ${emoji}`,
    `That ${keyword || 'vibe'} is unmatched. ${emoji}`,
    `The ${keyword || 'details'} here are so good. ${emoji}`,
    `Not me replaying this because of the ${keyword || 'energy'}. ${emoji}`,
  ];
  const tagTemplates = [
    `This is definitely the best #${tags[0] || 'vibes'} video I've seen today. Keep it up! ${emoji}`,
    `Okay but #${tags[0] || 'style'} is on point here. ${emoji}`,
    `We need more #${tags[0] || 'trend'} posts like this. ${emoji}`,
  ];
  const timestampTemplates = [
    `The transition at ${ts} was so smooth. How did you edit that? ${emoji}`,
    `Pause at ${ts}… that moment is everything. ${emoji}`,
    `At ${ts} I literally gasped. ${emoji}`,
  ];
  const genericTemplates = [
    `This is a whole vibe. ${emoji}`,
    `Can’t stop watching this. ${emoji}`,
    `You understood the assignment. ${emoji}`,
    `Instant repost. ${emoji}`,
  ];

  const hasDesc = !!(
    post?.meta_description ||
    post?.og_description ||
    post?.description
  );
  const hasTags = tags.length > 0;

  if (hasDesc && keyword) return pick(descriptionTemplates);
  if (hasTags) return pick(tagTemplates);
  if (caption && Math.random() < 0.25) {
    const words = wordsFromText(caption);
    const w = words.length ? pick(words) : '';
    if (w) return `The ${w} part is elite. ${emoji}`;
  }
  if (Math.random() < 0.35) return pick(timestampTemplates);
  return pick(genericTemplates);
}

function buildComments(autoUsers, post, count) {
  const n = clampInt(count, 0, 2500);
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = pick(autoUsers);
    out.push({
      _type: 'comment',
      _key: randomId(),
      comment: buildCommentText(post),
      postedBy: { _type: 'postedBy', _ref: u._id },
    });
  }
  return out;
}

async function publishPostsToSanity(posts, opts = {}) {
  const projectId = opts.projectId || defaultProjectId;
  const dataset = opts.dataset || defaultDataset;
  const apiVersion = opts.apiVersion || defaultApiVersion;
  const token = opts.token || defaultToken;
  const missing = [];
  if (!projectId) missing.push('NEXT_PUBLIC_SANITY_PROJECT_ID');
  if (!token) missing.push('NEXT_PUBLIC_SANITY_TOKEN');
  if (missing.length) {
    throw new Error(`Missing Sanity env vars: ${missing.join(', ')}`);
  }

  const client = buildClient({ projectId, dataset, apiVersion, token });
  const autoUsers = await ensureUsers(client, USER_NAME_SEEDS);

  let posted = 0;
  let skipped = 0;
  let failed = 0;
  const failedSamples = [];
  const postedLinks = [];

  await Promise.all(
    (posts || []).map(async (p) => {
      try {
        if (!p || !p.link) return;
        const sourceLink = p.link;
        const existing = await findExistingPost(client, sourceLink);
        if (existing && existing._id) {
          skipped++;
          return;
        }
        const videoUrl = p.video_src || p.video_url;
        if (!videoUrl) return;
        const owner = pick(autoUsers);
        const asset = await uploadVideoAsset(client, videoUrl, {
          referer: sourceLink,
        });
        const likeCount = pickLikeCount();
        const likeDocCount = clampInt(
          Math.round(likeCount * (0.002 + Math.random() * 0.012)),
          0,
          Math.min(140, autoUsers.length * 4),
        );
        const likeRefs = Array.from({ length: likeDocCount }).map(() => {
          const u = pick(autoUsers);
          return { _key: randomId(), _ref: u._id, _type: 'postedBy' };
        });
        const commentCount = pickCommentCountFromLikes(likeCount);
        const doc = {
          _id: postIdForSourceLink(sourceLink),
          _type: 'post',
          caption: clean(p.title),
          sourceLink,
          imageUrl: p.image_url || '',
          video: {
            _type: 'file',
            asset: { _type: 'reference', _ref: asset._id },
          },
          likeCount,
          userId: owner._id,
          postedBy: { _type: 'postedBy', _ref: owner._id },
          likes: likeRefs,
          comments: buildComments(autoUsers, p, commentCount),
          topic: (p.slinks_texts && p.slinks_texts[0]) || '',
        };
        await client.createIfNotExists(doc);
        posted++;
        postedLinks.push(sourceLink);
      } catch (e) {
        failed++;
        if (failedSamples.length < 8) {
          const msg = String(e && e.message ? e.message : e || '').slice(
            0,
            220,
          );
          failedSamples.push({ link: p?.link || '', error: msg });
        }
      }
    }),
  );

  return { posted, skipped, failed, failedSamples, postedLinks };
}

async function runCli() {
  const posts = await readDetails();
  const r = await publishPostsToSanity(posts);
  process.stdout.write(JSON.stringify({ ok: true, ...r }) + '\n');
}

module.exports = { publishPostsToSanity };

if (require.main === module) {
  runCli().catch((e) => {
    process.stderr.write(String(e && e.message ? e.message : e) + '\n');
    process.exitCode = 1;
  });
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { nanoid } = require('nanoid');
const { createClient } = require('next-sanity');

function loadDotEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    });
  } catch (_) {}
}
const root = path.resolve(__dirname, '..');
loadDotEnv(path.join(root, 'scripts', '.env'));
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-11-11';
const token = process.env.NEXT_PUBLIC_SANITY_TOKEN;
const scraperDir = path.join(root, 'python-scraper');
const detailsFile = path.join(scraperDir, 'post-details.json');

function clean(s) {
  if (!s) return '';
  return s.replace(/\s*–?\s*MmsBaba\.Com\s*$/i, '').trim();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function readDetails() {
  const raw = fs.readFileSync(detailsFile, 'utf-8');
  const json = JSON.parse(raw);
  return json.posts || [];
}

function buildClient() {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    ignoreBrowserTokenWarning: true,
  });
}

async function ensureUsers(client, names) {
  const users = [];
  for (const name of names) {
    const q = `*[_type=="user" && userName=="${name}"][0]{_id,userName,image}`;
    let u = await client.fetch(q);
    if (!u) {
      const id = nanoid();
      const img = pick([
        'https://i.pravatar.cc/300?img=5',
        'https://i.pravatar.cc/300?img=12',
        'https://i.pravatar.cc/300?img=25',
        'https://i.pravatar.cc/300?img=31',
        'https://i.pravatar.cc/300?img=45',
        'https://i.pravatar.cc/300?img=52',
      ]);
      const followerCount = Math.floor(Math.random() * 5_000_000) + 1;
      const doc = {
        _id: id,
        _type: 'user',
        userName: name,
        image: img,
        bio: 'Creator',
        followerCount,
      };
      await client.createIfNotExists(doc);
      u = { _id: id, userName: name, image: img };
    }
    users.push(u);
  }
  return users;
}

async function uploadVideoAsset(client, url) {
  const res = await axios.get(url, { responseType: 'stream' });
  const filename = path.basename(url.split('?')[0]) || `video-${nanoid()}.mp4`;
  const asset = await client.assets.upload('file', res.data, { filename });
  return asset;
}

async function findExistingPost(client, sourceLink) {
  if (!sourceLink) return null;
  const q = `*[_type=="post" && sourceLink=="${sourceLink}"][0]{_id}`;
  const doc = await client.fetch(q);
  return doc || null;
}

function buildComments(autoUsers, maxCount) {
  const compliments = [
    'Absolutely stunning look! 😍',
    'You’re the definition of style!',
    'That outfit just screams confidence!',
    'Your glow is not of this world! ✨',
    'You’re serving looks, and I’m here for all of it!',
  ];
  const flirty = [
    'Looking like a snack and a half! 🍫',
    'You’re not just a snack; you’re a full-course meal! 🍲',
    'If looks could kill, you’d be a serial killer! 🔥',
    'Are you a magician? Because whenever I look at your photos, everyone else disappears!',
    'Stop making everyone else look bad! 😆',
  ];
  const supportive = [
    'You’re crushing it at everything.',
    'Keep breaking barriers.',
    'Your energy is magnetic.',
    'The world is better with you in it.',
    'Forever proud of you.',
  ];
  const trendy = [
    'This post is straight fire – I love it! 🔥',
    'This selfie just hit different.',
    'Officially jealous of this post.',
    'I’d double-tap this a thousand times if I could.',
    'This post just made my day so much better.',
  ];
  const pool = [...compliments, ...flirty, ...supportive, ...trendy];
  const count = Math.min(maxCount, pool.length * 4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const txt = pick(pool);
    const u = pick(autoUsers);
    out.push({
      _type: 'comment',
      _key: nanoid(),
      comment: txt,
      postedBy: { _type: 'postedBy', _ref: u._id },
    });
  }
  return out;
}

async function run() {
  if (!projectId || !token) throw new Error('Missing Sanity env');
  const client = buildClient();
  const posts = await readDetails();
  const nameSeeds = [
    'Alanna Panday',
    'Sweetheart Superstar',
    'Fairy_Fresh',
    'Cute_Energy',
    'Starry Smile',
    'Velvet Vibes',
    'Luna Glow',
    'Cherry Charm',
    'Sunset Sparkle',
  ];
  const autoUsers = await ensureUsers(client, nameSeeds);
  for (const p of posts) {
    try {
      const existing = await findExistingPost(client, p.link);
      if (existing && existing._id) {
        console.log(`Skip existing: ${p.link}`);
        continue;
      }
      const likeCount = Math.floor(Math.random() * 10_000_000) + 1;
      const owner = pick(autoUsers);
      const asset = await uploadVideoAsset(client, p.video_src);
      const likeRefs = Array.from({
        length: Math.min(50, autoUsers.length),
      }).map(() => {
        const u = pick(autoUsers);
        return { _key: nanoid(), _ref: u._id, _type: 'postedBy' };
      });
      const comments = buildComments(autoUsers, 100);
      const doc = {
        _type: 'post',
        caption: clean(p.title),
        sourceLink: p.link,
        video: {
          _type: 'file',
          asset: { _type: 'reference', _ref: asset._id },
        },
        likeCount,
        userId: owner._id,
        postedBy: { _type: 'postedBy', _ref: owner._id },
        likes: likeRefs,
        comments,
        topic: (p.slinks_texts && p.slinks_texts[0]) || '',
      };
      await client.create(doc);
      const followerInc = Math.floor(Math.random() * 5_000_000) + 1;
      await client
        .patch(owner._id)
        .set({ followerCount: followerInc })
        .commit();
      console.log(`Posted: ${doc.caption}`);
    } catch (e) {
      console.log(`Failed: ${p.title} ${e.message}`);
    }
  }
}

run();

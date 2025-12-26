const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
        'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
        'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg',
        'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg',
        'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
        'https://images.pexels.com/photos/3617555/pexels-photo-3617555.jpeg',
        'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
        'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg',
        'https://images.pexels.com/photos/936064/pexels-photo-936064.jpeg',
        'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg',
        'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg',
        'https://images.pexels.com/photos/1578142/pexels-photo-1578142.jpeg',
        'https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg',
        'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
        'https://images.pexels.com/photos/3775536/pexels-photo-3775536.jpeg',
        'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg',
        'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg',
        'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg',
        'https://images.pexels.com/photos/4554019/pexels-photo-4554019.jpeg',
        'https://images.pexels.com/photos/45201/pexels-photo-45201.jpeg',
        'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg',
        'https://i.pravatar.cc/300?img=5',
        'https://i.pravatar.cc/300?img=12',
        'https://i.pravatar.cc/300?img=25',
        'https://i.pravatar.cc/300?img=31',
        'https://i.pravatar.cc/300?img=45',
        'https://i.pravatar.cc/300?img=52',
        'https://i.pravatar.cc',
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
  const q = '*[_type=="post" && sourceLink==$sourceLink][0]{_id}';
  const doc = await client.fetch(q, { sourceLink });
  return doc || null;
}

function postIdForSourceLink(sourceLink) {
  if (!sourceLink) return nanoid();
  const h = crypto.createHash('sha1').update(String(sourceLink)).digest('hex');
  return `post-${h}`;
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
    'Lina de',
    'Rubi le',
    'Mina de',
    'Sona le',
    'Riya de',
    'Piya le',
    'Nina de',
    'Tina le',
    'Maya de',
    'Joya le',
    'Rina de',
    'Liza le',
    'Nisa de',
    'Ruma le',
    'Puja de',
    'Mimi le',
    'Tuli de',
    'Bina le',
    'Sima de',
    'Kina le',

    'Anu de',
    'Mitu le',
    'Ritu de',
    'Piku le',
    'Jinu de',
    'Tiya le',
    'Oni de',
    'Kiki le',
    'Rani de',
    'Mini le',
    'Sumi de',
    'Lipi le',
    'Pori de',
    'Bithi le',
    'Jumi de',
    'Rupa le',
    'Nitu de',
    'Chaya le',
    'Mona de',
    'Riya le',

    'Sara de',
    'Zara le',
    'Nora de',
    'Luna le',
    'Mila de',
    'Alya le',
    'Isha de',
    'Noor le',
    'Anya de',
    'Sia le',
    'Kira de',
    'Tara le',
    'Zoya de',
    'Rhea le',
    'Mahi de',
    'Riva le',
    'Kiara de',
    'Pia le',
    'Alia de',
    'Diya le',

    'Jiya de',
    'Sana le',
    'Ana de',
    'Mira le',
    'Ina de',
    'Nila le',
    'Rosa de',
    'Lola le',
    'Vina de',
    'Tina le',
    'Sila de',
    'Kona le',
    'Rima de',
    'Mina le',
    'Nami de',
    'Yara le',
    'Fari de',
    'Pepa le',
    'Lami de',
    'Suri le',

    'Bela de',
    'Kiki le',
    'Meli de',
    'Toya le',
    'Jala de',
    'Ravi le',
    'Neya de',
    'Lumi le',
    'Sobi de',
    'Rela le',
    'Pali de',
    'Misu le',
    'Kavi de',
    'Rinu le',
    'Nobi de',
    'Tinu le',
    'Jesi de',
    'Fina le',
    'Rila de',
    'Zeni le',
    'Mavi de',
    'Rosi le',
    'Kani de',
    'Yumi le',
    'Sofi de',
    'Nori le',
    'Lavi de',
    'Mori le',
    'Jovi de',
    'Tori le',
    'Bani de',
    'Puri le',
    'Gina de',
    'Vivi le',
    'Dina de',
    'Leni le',
    'Savi de',
    'Kori le',
    'Reni de',
    'Zivi le',
    'Lina Ray',
    'Lina Noor',
    'Lina Bloom',
    'Lina Rose',
    'Lina Sky',
    'Lina Moon',
    'Lina Star',
    'Lina Glow',
    'Lina Pearl',
    'Lina Soft',

    'Rubi Ray',
    'Rubi Noor',
    'Rubi Bloom',
    'Rubi Rose',
    'Rubi Sky',
    'Rubi Moon',
    'Rubi Star',
    'Rubi Glow',
    'Rubi Pearl',
    'Rubi Soft',

    'Mina Ray',
    'Mina Noor',
    'Mina Bloom',
    'Mina Rose',
    'Mina Sky',
    'Mina Moon',
    'Mina Star',
    'Mina Glow',
    'Mina Pearl',
    'Mina Soft',

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

    'Maya Ray',
    'Maya Noor',
    'Maya Bloom',
    'Maya Rose',
    'Maya Sky',
    'Maya Moon',
    'Maya Star',
    'Maya Glow',
    'Maya Pearl',
    'Maya Soft',

    'Sara Ray',
    'Sara Noor',
    'Sara Bloom',
    'Sara Rose',
    'Sara Sky',
    'Sara Moon',
    'Sara Star',
    'Sara Glow',
    'Sara Pearl',
    'Sara Soft',

    'Zara Ray',
    'Zara Noor',
    'Zara Bloom',
    'Zara Rose',
    'Zara Sky',
    'Zara Moon',
    'Zara Star',
    'Zara Glow',
    'Zara Pearl',
    'Zara Soft',

    'Mila Ray',
    'Mila Noor',
    'Mila Bloom',
    'Mila Rose',
    'Mila Sky',
    'Mila Moon',
    'Mila Star',
    'Mila Glow',
    'Mila Pearl',
    'Mila Soft',
    'Lina Velvet',
    'Rubi Desire',
    'Mina Flame',
    'Riya Seduce',
    'Piya Tempt',
    'Maya Fever',
    'Sara Sultry',
    'Zara Bliss',
    'Mila Heat',
    'Kiara Crush',

    'Luna Siren',
    'Noor Desire',
    'Rose Temptation',
    'Cherry Sin',
    'Velvet Kiss',
    'Scarlet Touch',
    'Midnight Muse',
    'Satin Glow',
    'Blush Heat',
    'Dark Honey',

    'Angel Sin',
    'Sweet Venom',
    'Silk Whisper',
    'Soft Seduction',
    'Hot Petals',
    'Wild Rose',
    'Burning Bloom',
    'Golden Lust',
    'Pink Obsession',
    'Bare Desire',

    'Queen Heat',
    'Femme Fever',
    'Savage Doll',
    'Luxury Sin',
    'Midnight Babe',
    'Dirty Blush',
    'Glossy Tempt',
    'Rich Desire',
    'Pretty Vice',
    'Urban Siren',

    'Brown Sugar',
    'Velvet Babe',
    'Spicy Rose',
    'Desi Flame',
    'Noor Heat',
    'Saffron Sin',
    'Hot Rani',
    'Royal Tempt',
    'Golden Kiss',
    'Desire Queen',

    'Gloss Lips',
    'Sultry Eyes',
    'Naked Glow',
    'Soft Bite',
    'Hot Aura',
    'Red Velvet',
    'Satin Skin',
    'Mocha Heat',
    'Candy Vice',
    'Blazing Beauty',
  ];
  const autoUsers = await ensureUsers(client, nameSeeds);
  for (const p of posts) {
    try {
      if (!p || !p.link) continue;
      const existing = await findExistingPost(client, p.link);
      if (existing && existing._id) {
        if (p.image_url) {
          await client
            .patch(existing._id)
            .setIfMissing({ imageUrl: p.image_url })
            .commit();
        }
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
        _id: postIdForSourceLink(p.link),
        _type: 'post',
        caption: clean(p.title),
        sourceLink: p.link,
        imageUrl: p.image_url || '',
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
      await client.createIfNotExists(doc);
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

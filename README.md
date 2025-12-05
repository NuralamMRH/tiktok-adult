<h2 align='center'>TikTok clone | video sharing web app</h2>

![](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/8ia7odl3vkqcurq6v91s.png)

<p align='center'>
  <img  src='https://dev-to-uploads.s3.amazonaws.com/uploads/articles/6z1029fv99zdmni361i3.png' />
</p>

### Features

- [x] Authentication 🔑 - (login | logout with google auth provider)
- [x] Upload Video 🎞
- [x] Delete (videos | comments) by author 🤔🫣
- [x] Video Detail ✨
- [x] Different Topic page 👀✨
- [x] Search (by topic | by keywords) 👀🔎
- [x] User Profile 🧸👩🏿‍💻 (editable bio)
- [x] Follow | Unfollow 👥
- [x] Like | Comment ❤️‍🔥💬
- [x] Social share 🌍🚀 (native sharing mechanism on mobile device)
- [x] Theme 🌞🌙 (light | dark)
- [x] Progressive web app (PWA) 🚀🔥
- [x] Fully Responsive 📱💻

### Tech stack

- [x] **Frontend** - [Nextjs](https://nextjs.org/)
- [x] **Type checking** - [Typescript](https://www.typescriptlang.org/)
- [x] **Backend** - [Sanity](https://www.sanity.io/)
- [x] **Styling** - [Tailwindcss](https://tailwindcss.com/)
- [x] **UI Component** - [HeadlessUI](https://headlessui.com/)
- [x] **Auto play on scroll** - [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [x] **Authentication** - [Nextauth](https://next-auth.js.org/)
- [x] **State management** - [Zustand](https://zustand-demo.pmnd.rs/)

<!-- Run Locally -->

### :running: Run Locally

#### Clone the project

```bash
  git@github.com:zwelhtetyan/tiktok-clone.git
```

#### Go to the project directory

```bash
  cd tiktok-clone
```

#### Remove remote origin

```bash
  git remote remove origin
```

#### Install dependencies

```bash
  yarn
```

#### :key: Environment Variables

To run this project, you will need to add the following environment variables to your `.env.local` file

`GOOGLE_CLIENT_ID` - (`your google client id`)

`GOOGLE_CLIENT_SECRET` - (`your google client secret`)

`NEXT_PUBLIC_ROOT_URL` - (`http://localhost:3000`)

`NEXTAUTH_URL` - (`http://localhost:3000`)

### Create sanity studio

Firstly, follow the instructions from sanity's official documentation
[here.](https://www.sanity.io/get-started/create-project?originUrl=https%3A%2F%2Fwww.sanity.io%2Fdocs%2Fgetting-started-with-sanity)

After creating sanity account from above instructions, you will get `create command` to install sanity studio like this `npm create sanity@latest -- --template get-started --project PROJECTID --dataset production --provider PROVIDER_NAME`

And then, create a new folder under the root folder

```bash
  mkdir sanity-backend
```

#### Install sanity studio

```bash
  cd sanity-backend
  npm create sanity@latest -- --template get-started --project `YOUR_PROJECTID` --dataset production --provider `YOUR_PROVIDERNAME`
```

And then, replace your `schemas` folder with mine (`from sanity/schemas`);

Note: If you have an error `Cannot read property of undefined (reading 'config')`, simply add `tailwind.config.js` file in the root of `sanity-backend` folder with below content.

```tsx
// tailwind.config.js
module.exports = {
  content: [],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

#### Run sanity studio

```bash
  yarn dev
```

And then, you can view sanity studio on [http://localhosts:3333](http://localhosts:3333)

### Add env in the root folder (`tiktok-clone/.env.local`)

Get your `TOKEN` and `PROJECTID` from sanity studio

`NEXT_PUBLIC_SANITY_TOKEN` - (`your sanity token`)

`NEXT_PUBLIC_SANITY_PROJECT_ID` - (`your sanity projectId`)

`NEXT_PUBLIC_SANITY_API_VERSION` - (`2023-11-11`)

> Note: Please make sure you allow the `CORS` orgin in you sanity-studio

#### Run the app

Please make sure you are in the root folder (`/tiktok-clone:`)

```bash
  yarn dev
```

### :whale: Docker

Upload to VPS

- Local command to upload the zip to your server:
  - scp web-tiktok-clone.zip root@35.134.122.100:/var/www/
- Notes:
  - This will prompt for your SSH key passphrase or password.
  - If using a different key: scp -i ~/.ssh/your_key web-tiktok-clone.zip root@35.134.122.100:/var/www/
    Remote Extraction and Docker Install

- SSH into the VPS:
  - ssh root@35.134.122.100
- Run these commands:
  - cd /var/www
  - apt update && apt install -y unzip
  - unzip -o web-tiktok-clone.zip -d web-tiktok-clone
  - rm -rf /var/www/wordpress
- Install Docker and Compose plugin:
  - apt install -y ca-certificates curl gnupg
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  - chmod a+r /etc/apt/keyrings/docker.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  - apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    Configure Environment

- Create /var/www/web-tiktok-clone/.env :
  - NEXT_PUBLIC_SANITY_PROJECT_ID=...
  - NEXT_PUBLIC_SANITY_DATASET=production
  - NEXT_PUBLIC_SANITY_TOKEN=...
  - INITIAL_FULL_RUN=1 (first-time only; sets one full extraction)
  - PAGE_LIMIT=188 (full extraction limit)
  - DAILY_PAGE_LIMIT=1 (one page per day after initial run)
  - DAILY_INTERVAL_SECONDS=86400
- Optional: add other NEXTAUTH\_\* or app vars as needed.

#### Run the app

Please make sure you are in the root folder (`/web-tiktok-clone:`)

```bash
  docker compose up --build
```

Start Containers

- From /var/www/web-tiktok-clone :
  - docker compose --env-file .env up -d
- Verify:
  - docker ps
  - docker logs web-tiktok-clone-python_scraper -f
  - docker logs web-tiktok-clone-web -f
    Nginx

- Domain tiktokvideo.xyz is already set up under /etc/nginx/sites-available . Point the upstream to 127.0.0.1:3000 and reload:
  - Ensure your server block has:
    - location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
  - nginx -t && systemctl reload nginx
- SSL (if not already):
  - apt install -y certbot python3-certbot-nginx
  - certbot --nginx -d tiktokvideo.xyz -d www.tiktokvideo.xyz

  Health Checks

- Web app: curl -I http://127.0.0.1:3000
- App summary: open https://tiktokvideo.xyz/summary
- Scraper writes scraping-summary.json to shared volume ( /app/shared in container), which the web app reads.

#### Production (build and run)

- From `/var/www/web-tiktok-clone`:
  - `docker compose up -d --build` (builds images and starts `web`, `scraper`, `publisher`)
- Nginx reverse proxy:
  - Copy config: `cp /var/www/web-tiktok-clone/nginx/tiktokvideo.xyz.conf /etc/nginx/sites-available/tiktokvideo.xyz`
  - Enable: `ln -sf /etc/nginx/sites-available/tiktokvideo.xyz /etc/nginx/sites-enabled/tiktokvideo.xyz`
  - Test and reload: `nginx -t && systemctl reload nginx`
- Domain:
  - App: `http://tiktokvideo.xyz/`
  - Logs: `http://tiktokvideo.xyz/logs/`

#### Development (hot reload in Docker)

- Stop prod app if running: `docker compose stop web`
- Start dev app (hot reload): `docker compose --profile dev up web-dev scraper`
  - `web-dev` mounts the source (`.:/app`) and runs `next dev` for live changes
  - App is available on `http://localhost:3000` (Nginx can proxy to port 3000)
- Edit files; changes reflect immediately without rebuild
- Switch back to prod: `docker compose stop web-dev && docker compose up -d --build web`

#### Environment Notes

- Public origin: set `NEXT_PUBLIC_ROOT_URL=http://tiktokvideo.xyz` in `.env.local` on the server to avoid `localhost` in client HTML
- Image loading: `next.config.js` sets `images.unoptimized: true` to load avatars reliably under Nginx

#### Health & Logs

- `docker ps`
- `docker logs -f web-tiktok-clone-web` (prod) or `docker logs -f web-tiktok-clone-web-dev` (dev)
- `docker logs -f web-tiktok-clone-scraper`
- `docker logs -f web-tiktok-clone-publisher`

Finally, you can view the app on `http://localhost:3000`

<!-- Contributing -->

<br />

### :wave: Contributing

<a href="https://github.com/Louis3797/awesome-readme-template/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nuralammrh/tiktok-clone" />
</a>

#### Contributions are always welcome!

<!-- Contact -->

### Author

- [@rancoded](https://www.linkedin.com/in/rancoded/)

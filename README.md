# Quest AR

A mobile-first WebXR learning game that turns trivia into an augmented-reality scavenger hunt.

**Static demo:** https://connorsawaya.github.io/QuestAR/

Players choose a topic, generate trivia orbs, scan the floor, follow a radar route, and physically move through an AR space to discover and answer questions.

### Highlights

- WebXR immersive AR with floor detection and anchored 3D objects
- AI-backed topic generation with built-in fallback question banks
- Radar-guided scavenger-hunt gameplay
- XP, streaks, levels, collections, and a leaderboard
- PostgreSQL-backed server mode with local development fallback
- Mobile-first experience built with Three.js, Vite, JavaScript, and Node.js

> The GitHub Pages link is a static showcase. Full API, database, and AI-backed features require the Node server.


## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm test
```

## Serve Built App

```bash
npm start
```

`npm start` serves the `dist` folder through `server.js`. It uses Railway's `PORT` environment variable automatically and falls back to port `4173` locally.

## GitHub Pages Static Demo

The `main` branch deploys a static build to <https://connorsawaya.github.io/QuestAR/>. See [the Pages setup and local demo notes](docs/github-pages.md). GitHub Pages does not run the Node API or its database-backed features.

### Install on Android

The Pages demo can be installed from Android Chrome with **Install app** or **Add to Home screen**. The Android Studio project also builds signed APK and AAB artifacts using a Trusted Web Activity, which keeps QuestAR in Chrome's WebXR/ARCore runtime. See [the Android project and signing guide](android/README.md) and [the hosting and device notes](docs/github-pages.md). TWA verification needs the deployed `/quest-ar/app/` host and the root Asset Links file.

The local server also exposes:

```text
GET  /api/profile?playerId=...
POST /api/answer
POST /api/collect
GET  /api/leaderboard
POST /api/generate-topic
```

Topic generation uses NVIDIA NIM when `NVIDIA_API_KEY` is set. The model defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`; set `NIM_MODEL` to override it. If NIM is unavailable, the server falls back to built-in topic question banks.

For local secret setup, copy `.env.example` to `.env` and fill in your own values. `.env` is ignored by Git.

## Railway

Use the default Node deployment flow:

```bash
npm install
npm run build
npm start
```

Add a Railway PostgreSQL database to the project so Railway provides `DATABASE_URL`. The app will create its `players` table automatically on startup.

Set `NODE_ENV=production` and `TRUST_PROXY_HEADERS=true` on the app service. Railway sets `X-Real-IP`; enabling proxy-header trust lets API limits apply per visitor instead of sharing a single limit across the service. Do not enable this setting on a server that is directly reachable by untrusted clients.

The API enforces request-body limits and per-IP limits: 60 profile and leaderboard reads, 30 answers, 15 collections, and 6 topic generations per minute. The topic-generation limit helps contain NVIDIA usage. Limits are held in process memory, so keep one app replica unless you add a shared rate-limit store or edge limits. The public leaderboard is a casual game feature; clients can still fabricate answers, so do not use its scores as verified identity or achievement records.

The per-player collection list is capped at 250 entries to bound database growth. Repeated collection IDs do not award additional XP.

Optional Railway environment variables:

```text
NVIDIA_API_KEY=your-nim-key
NIM_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
DATABASE_SSL=true
```

`DATABASE_URL` is required in production. The local JSON fallback is development-only and can lose writes if several local requests update the file at once.

The server accepts Node.js `^20.19.0 || >=22.12.0` (matching Vite 8) and the start flow is `npm ci`, `npm run build`, `npm start`. A production deploy without the Railway PostgreSQL reference will fail at startup instead of silently losing leaderboard data.

Run the server and API checks with:

```bash
npm test
```

## Test On Android Chrome

WebXR immersive AR requires HTTPS on a real phone.

1. Use an Android phone with ARCore support.
2. Open the site in the Chrome app.
3. Serve the Vite dev server through HTTPS, such as Cloudflare Tunnel or ngrok.
4. Generate topic orbs from the landing prompt.
5. Tap `Start AR`.
6. Move the phone slowly until the floor is detected.
7. Use Radar to walk toward each hidden orb.
8. When an orb appears, get close, center it, and tap to start the quiz.

## Project Files

```text
index.html
src/main.js
src/style.css
vite.config.js
server.js
package.json
README.md
```

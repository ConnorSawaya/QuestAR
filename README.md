# Quest AR

A mobile-first WebXR educational scavenger hunt built with Vite, JavaScript, and Three.js.

Players choose a topic, generate AI-backed trivia orbs, start an immersive AR session, scan the floor, follow a radar route, and walk to reveal hidden topic orbs. Each orb stays anchored after discovery and can be completed by getting close, centering it, tapping it, and answering its trivia quiz.

Orb achievement progress is saved in the browser with IndexedDB. XP, answer streaks, levels, completed orb counts, and the global leaderboard are saved through the Node server.

The server uses:

1. PostgreSQL when `DATABASE_URL` exists, which is the recommended Railway setup.
2. A local `.data/quest-ar-db.json` file when `DATABASE_URL` is not set, which is useful for local testing.

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` starts both the Vite client on `5173` and the local API server on `4173`. The Vite dev server proxies `/api/*` requests to `server.js`, so topic generation, profile XP, and leaderboard requests work from the landing page during local development.

## Build

```bash
npm run build
```

## Serve Built App

```bash
npm start
```

`npm start` serves the `dist` folder through `server.js`. It uses Railway's `PORT` environment variable automatically and falls back to port `4173` locally.

The local server also exposes:

```text
GET  /api/profile?playerId=...
POST /api/answer
POST /api/collect
GET  /api/leaderboard
POST /api/generate-topic
```

Topic generation uses NVIDIA NIM when `NVIDIA_API_KEY` is set. The model defaults to `google/gemma-2-27b-it`; set `NIM_MODEL` to override it. If NIM is unavailable, the server falls back to built-in topic question banks.

For local secret setup, copy `.env.example` to `.env` and fill in your own values. `.env` is ignored by Git.

## Railway

Use the default Node deployment flow:

```bash
npm install
npm run build
npm start
```

Add a Railway PostgreSQL database to the project so Railway provides `DATABASE_URL`. The app will create its `players` table automatically on startup.

Optional Railway environment variables:

```text
NVIDIA_API_KEY=your-nim-key
NIM_MODEL=google/gemma-2-27b-it
DATABASE_SSL=true
```

Without `DATABASE_URL`, the server still works using the local JSON database fallback, but that is not recommended for production leaderboards.

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

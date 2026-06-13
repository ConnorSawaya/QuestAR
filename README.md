# Quest AR

A mobile-first WebXR scavenger hunt built with Vite, JavaScript, and Three.js.

Players start an immersive AR session, scan the floor, follow a radar route, and walk to reveal three hidden animals: Panda, Lion, and Elephant. Each animal stays anchored after discovery and can be collected by getting close, centering it, tapping it, and answering its trivia quiz.

Animal achievement progress is saved in the browser with IndexedDB. XP, answer streaks, levels, collected animal counts, and the global leaderboard are saved through the Node server.

The server uses:

1. PostgreSQL when `DATABASE_URL` exists, which is the recommended Railway setup.
2. A local `.data/quest-ar-db.json` file when `DATABASE_URL` is not set, which is useful for local testing.

## Run Locally

```bash
npm install
npm run dev
```

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
```

## Railway

Use the default Node deployment flow:

```bash
npm install
npm run build
npm start
```

Add a Railway PostgreSQL database to the project so Railway provides `DATABASE_URL`. The app will create its `players` table automatically on startup.

Without `DATABASE_URL`, the server still works using the local JSON database fallback, but that is not recommended for production leaderboards.

## Test On Android Chrome

WebXR immersive AR requires HTTPS on a real phone.

1. Use an Android phone with ARCore support.
2. Open the site in the Chrome app.
3. Serve the Vite dev server through HTTPS, such as Cloudflare Tunnel or ngrok.
4. Tap `Start AR`.
5. Move the phone slowly until the floor is detected.
6. Use Radar to walk toward each hidden animal.
7. When an animal appears, get close, center it, and tap to start the quiz.

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

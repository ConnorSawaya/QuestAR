# Quest AR

A mobile-first WebXR scavenger hunt built with Vite, JavaScript, and Three.js.

Players start an immersive AR session, scan the floor, follow a radar route, and walk to reveal three hidden animals: Panda, Lion, and Elephant. Each animal stays anchored after discovery and can be collected by getting close, centering it, tapping it, and answering its trivia quiz.

Progress is saved in the browser with IndexedDB. That means achievements and quiz progress persist on the same device whether the app is running locally or deployed to Railway.

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

## Railway

Use the default Node deployment flow:

```bash
npm install
npm run build
npm start
```

No separate hosted database is required for this version because progress is stored in the player's browser database.

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

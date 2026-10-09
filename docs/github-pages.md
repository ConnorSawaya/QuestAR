# GitHub Pages static demo

The `main` branch workflow builds this Vite app with the `/QuestAR/` base path, runs the Node test suite, and deploys `dist` to <https://connorsawaya.github.io/QuestAR/>. It also builds a second copy under `dist/quest-ar/app/` for the Android Trusted Web Activity at <https://connors.dev/quest-ar/app/>. It runs on pushes to `main` and can also be started manually from the repository's Actions tab. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

For a local development demo, run:

```bash
npm ci
npm run dev
```

To preview the installable production app locally at the site root:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

Open <http://127.0.0.1:4173/>. To check the GitHub Pages asset paths, build with `GITHUB_PAGES=true npm run build -- --mode pages`; the generated bundle expects the `/QuestAR/` path used by GitHub Pages. Development and the existing Node/Railway build keep the `/` base path.

GitHub Pages serves static files only. The public Pages demo stays local-only, with built-in questions and progress saved on the device. The Android app served from `connors.dev` can use a separate serverless endpoint for online NVIDIA-backed topic generation while keeping progress on-device.

The Vercel project for `connors.dev` must be deployed with rewrites for `/quest-ar/app/` and its files to the nested GitHub Pages build. The domain root must serve `/.well-known/assetlinks.json` with the Android application id `dev.connors.questar` and the release certificate fingerprint. Without this domain association, Android Browser Helper safely opens the site in a Custom Tab with browser controls.

The TWA build calls `https://connors.dev/api/generate-topic` for custom topic requests. The function in the `connors.dev` repository requires `NVIDIA_API_KEY` in Vercel's server-side environment; `NIM_MODEL` is optional. Never place the NVIDIA key in a Vite variable or Android package. The API only generates questions: profile, scores, and collections remain on the phone. If the endpoint is unavailable, generation falls back to a two-stop local practice route with six unique prompts. The separate QuestAR Node API remains optional for shared profile and leaderboard features.

The app uses NVIDIA NIM for custom AI-generated questions when online. On-device Gemini Nano Prompt API is not available on the connected Pixel 7 according to [Google's supported-device list](https://developers.google.com/ml-kit/genai), which currently lists Pixel 9 and newer. A future downloadable model would need a native [LiteRT-LM Android integration](https://developers.google.com/edge/litert-lm/android) and a separate model download; even mobile models need substantial storage and memory ([model estimates](https://ai.google.dev/gemma/docs/core.md#litert-lm-memory)). Keep the curated local packs as the guaranteed offline experience.

## Install on Android

The Pages demo is an installable web app. On an Android phone, open <https://connorsawaya.github.io/QuestAR/> in Chrome, open the browser menu, and choose **Install app** or **Add to Home screen**. The QuestAR icon launches the demo in its own window. The built-in question packs and saved progress work without an account or API; the service worker caches the app shell and same-origin app assets after the first visit. API requests and third-party map tiles are not cached.

WebXR still depends on Chrome, a secure HTTPS origin, and a supported ARCore device. The local quiz route works without camera or location access. The static GitHub Pages app is not the Android package; see [the Android project README](../android/README.md) for the Android Studio build and install steps.

## Add a local question pack

The Pages experience is intentionally local-first. `src/local-demo.js` owns its built-in content; `src/main.js` chooses the local flow for the Pages build and stores quiz progress on the current device.

1. Add a category to `QUESTION_BANKS`. Each question is `[prompt, answerOptions, correctOptionIndex]`.
2. Add a matching keyword rule to `CATEGORY_RULES`, plus six orb names and a color/style entry in `ORB_NAMES` and `CATEGORY_STYLE`.
3. Add or update a focused case in `test/local-demo.test.js`; check that every answer index points to an existing option.
4. Keep unknown custom topics on the general practice fallback. Do not add API keys, accounts, or server calls to this static mode.

Push the change to `main` to run the tests and update GitHub Pages. A portfolio card, screenshot, or `/quest-ar` route change is separate and deploys with the `connors.dev` repository.

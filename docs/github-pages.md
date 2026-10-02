# GitHub Pages static demo

The `main` branch workflow builds this Vite app with the `/QuestAR/` base path, runs the Node test suite, and deploys `dist` to <https://connorsawaya.github.io/QuestAR/>. It runs on pushes to `main` and can also be started manually from the repository's Actions tab. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

For a local development demo, run:

```bash
npm ci
npm run dev
```

To build and preview the same subpath bundle as Pages:

```bash
GITHUB_PAGES=true npm run build -- --mode pages
npm run preview -- --host 127.0.0.1
```

Open <http://127.0.0.1:4173/QuestAR/>. The flag is only used by the build; development and the existing Node/Railway build keep the `/` base path.

GitHub Pages serves static files only. It does not run `server.js`, PostgreSQL, or NVIDIA-backed topic generation. Use the existing Node deployment for those server features; Pages-specific client behavior should remain usable without those services.

## Add a local question pack

The Pages experience is intentionally local-first. `src/local-demo.js` owns its built-in content; `src/main.js` chooses the local flow for the Pages build and stores quiz progress on the current device.

1. Add a category to `QUESTION_BANKS`. Each question is `[prompt, answerOptions, correctOptionIndex]`.
2. Add a matching keyword rule to `CATEGORY_RULES`, plus six orb names and a color/style entry in `ORB_NAMES` and `CATEGORY_STYLE`.
3. Add or update a focused case in `test/local-demo.test.js`; check that every answer index points to an existing option.
4. Keep unknown custom topics on the general practice fallback. Do not add API keys, accounts, or server calls to this static mode.

Push the change to `main` to run the tests and update GitHub Pages. A portfolio card, screenshot, or `/quest-ar` route change is separate and deploys with the `connors.dev` repository.

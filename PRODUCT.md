# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students studying on their own. They choose a subject and difficulty, then learn through short questions while exploring a scavenger hunt.

## Product Purpose

QuestAR turns study topics into a mobile scavenger hunt. Success means a student can choose a topic and begin a hunt quickly, then answer questions and review progress.

## Positioning

The learning loop combines trivia with collecting virtual orbs placed in the learner's surroundings through WebXR on supported phones and browsers.

## Operating Context

The interface is mobile-first. The GitHub Pages and portfolio demos use built-in question packs, save progress in the browser when storage is available, and do not require an account, backend, or AI key. Immersive AR needs a compatible phone and browser. The local/server version also supports generated topics, API-backed question flows, and server-side persistence.

## Capabilities and Constraints

- Five main areas: Hunt, Radar, Map, Journal, and You.
- A hunt contains six collectible orbs with three questions each, plus XP, streaks, and levels.
- Students can set a topic and difficulty. The public static demo uses built-in packs and local study prompts for custom topics.
- The immersive view uses WebXR and device capabilities. Browser permissions and hardware support can limit AR and location features.
- Keep the static demo usable without camera or location access; its local mode uses no camera or location.
- Android use should preserve Chrome WebXR support where possible; native WebView support is not established by this repository.

## Evidence on Hand

- Product implementation: `src/main.js`, `src/local-demo.js`, `index.html`, and `src/style.css`.
- Public demo behavior and setup: `README.md` and `docs/github-pages.md`.
- No real-world study efficacy claims, classroom deployments, or user testimonials are documented.

## Product Principles

- Make choosing a topic and starting a hunt quick.
- Keep the next action clear during study and AR play.
- Explain progress through the learner's collected orbs, answers, and streak.
- Make the non-AR demo useful on its own.
- Present device-dependent features with honest support and permission states.

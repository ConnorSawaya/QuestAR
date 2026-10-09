# QuestAR Android app

QuestAR uses a Trusted Web Activity (TWA) with Android Browser Helper. The app launches the production web build in Chrome, preserving Three.js and WebXR's browser-provided ARCore path. It is not an Android WebView and does not request camera or location permissions at install time. Chrome asks for camera access when a player starts AR; location is requested only after the player chooses **Show my location once** on the map.

Once the APK is installed, QuestAR does not need a computer. It needs an internet connection for the first launch so Chrome can load the hosted app and install its service worker. After that, the app shell, scripts, styles, and built-in question packs are cached on the phone; local quiz progress is stored on the phone. Server-generated questions, shared profiles, and maps still need internet. The installed Android icon opens the app directly.

The launcher opens `https://connors.dev/quest-ar/app/`. That path must be live over HTTPS and serve the Android web build. The domain must also serve `/.well-known/assetlinks.json` with the package name and signing certificate fingerprints before Chrome can verify the TWA and remove browser controls. Until both files are deployed, the app falls back to a Custom Tab with browser UI.

## Build a debug APK

Open this `android` directory in Android Studio, or run:

```powershell
.gradlew.bat assembleDebug
```

The installable debug APK is `app/build/outputs/apk/debug/app-debug.apk`. It is signed with the local Android debug key and has the application id `dev.connors.questar.debug`.

For local UI checks, pass `-PquestarLaunchUrl=http://10.0.2.2:5173/` to the Gradle command while a Vite dev server is running. This debug-only test origin uses a browser fallback and cannot validate WebXR or TWA verification.

## Configure a release key

Keep the upload keystore and passwords outside source control. Save the filled-in properties as `%USERPROFILE%\.questar\release-signing.properties`, point `storeFile` at a keystore outside this repository, and fill in the alias and passwords using `release-signing.properties.example` as a template. Gradle looks there automatically. Back up the keystore securely: losing it prevents future updates signed with the same upload certificate.

Create a key with the Android SDK's `keytool`, for example:

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\QuestAR", "$env:USERPROFILE\.questar"
keytool -genkeypair -v -keystore "$env:LOCALAPPDATA\QuestAR\questar-upload.jks" -alias questar-upload -keyalg RSA -keysize 2048 -validity 10000
```

Then build both signed release formats:

```powershell
.gradlew.bat assembleRelease bundleRelease
```

Outputs are `app/build/outputs/apk/release/app-release.apk` and `app/build/outputs/bundle/release/app-release.aab`. Google Play requires target API 36 for new apps and updates after August 31, 2026. The current project targets API 36.

## Hosting and service setup

The Pages workflow keeps publishing the regular `/QuestAR/` demo and also builds the production TWA variant into `dist/quest-ar/app/`. The portfolio's Vercel rewrite maps `/quest-ar/app/` and its assets to that second Pages path, and serves `/.well-known/assetlinks.json` with the upload certificate used for the local release artifacts. Deploy both repositories for the TWA URL to resolve. When Play App Signing is configured, add the Play app-signing certificate fingerprint to Asset Links as well; Play-installed APKs use that certificate instead of the upload key.

For server features, set `VITE_API_BASE_URL` at web build time to the HTTPS origin of the deployed QuestAR Node service. On the API service, set `CORS_ALLOWED_ORIGINS=https://connors.dev` (plus any additional exact origins you intend to allow). The static Pages demo does not contain server-backed topic generation or shared accounts; if the API is unreachable, it offers a clearly labeled, shorter local practice route.

## Verification limits

A successful Gradle build verifies the Android package, not immersive AR. Final AR validation still requires a physical ARCore-supported Android phone running a compatible Chrome version and the deployed, verified TWA origin. Test camera permission denial, tracking interruption, screen rotation, and return-from-background on that device before a public release.

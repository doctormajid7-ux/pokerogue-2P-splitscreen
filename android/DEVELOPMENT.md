<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# Android development notes

The Android app packages the web build from `dist/` in a full-screen WebView. It has a solo launcher and a two-player split-screen launcher. Player-facing instructions are in [README.md](./README.md) and [README.fr.md](./README.fr.md).

## Requirements

- JDK 17 or newer (OpenJDK 21 has been used).
- Android SDK with `platforms;android-35` and `build-tools;35.0.0` or newer. The build script reads `ANDROID_HOME` and otherwise uses `~/android-sdk`.
- Node.js and pnpm. From the repository root, install dependencies with `pnpm install --frozen-lockfile`.
- For background music conversion: `ffmpeg`, `ffprobe`, and the `libmp3lame` encoder.

Initialize both Git submodules before building:

```bash
git submodule update --init --recursive
```

Use the Node.js and pnpm versions pinned by `.nvmrc` and `package.json`.

Gradle 8.13, Android Gradle Plugin 8.7.3, Kotlin 2.1.0, and AndroidX WebKit are downloaded on the first Android build. Later builds can run offline if those dependencies are cached.

## Build and install

From the repository root:

```bash
pnpm install --frozen-lockfile
./android/compress-bgm.sh
pnpm build:app
./android/build-apk.sh
```

Run the compression step before the web build when creating a compact Android package. It converts background music in the local `assets` submodule to 32 kbit/s or lower; the encoded files are then copied into `dist/` and bundled by Gradle. This step requires FFmpeg and FFprobe. It changes the submodule working tree; rerun it after checking out fresh or updated assets. The source audio can be restored with `git -C assets restore audio/bgm`.

The web build must exist before Gradle packages it. To install the debug build on a connected device, run:

```bash
./android/build-apk.sh installDebug
```

The APK is saved as `android/apks/PokeRogue-Android-2Players.apk`. `prepareWww` copies `dist/` (without source maps) and the 2P shell, including its GBA-style setup screen, into `android/app/src/main/assets/www/`. That generated directory is ignored by Git.

## Background audio assets

The 178 background tracks are packaged at 32 kbit/s or lower after running the compression step. The build uses those files directly and does not package an extra high-quality copy. If assets are checked out again or updated, run the script before rebuilding. The script leaves files already at or below 32 kbit/s unchanged.

## Two-player app structure

The Android app has two launcher entries: **PokéRogue** for solo play and **PokéRogue 2Players** for the portrait split-screen shell at `assets/www/shell/2p.html`.

- The bottom half belongs to P1. The top half belongs to P2 and is rotated 180 degrees. Each half embeds its own same-origin game frame with a profile-scoped storage prefix.
- Each frame has independent saves, settings, language preference, and touch controls. The shell owns the shared match rules and progress journal.
- The shell and frames exchange validated, versioned `postMessage` messages defined in `src/system/shell-protocol.ts`. A frame's identity is derived from its window source, not from a player ID in its message.
- In Block Match, each run is frozen at a safe boundary. The shell persists both team snapshots, and both frames reconstruct the same duel from those snapshots. PvE saves are not used as the live source of duel teams.
- In Random Quick Battle, P1's game frame generates both teams and sends both frozen snapshots to the shell. A single generation step keeps the teams and movesets identical across both duel frames.
- Battles use the Phaser scene and the game's sprites, animations, health bars, menus, and messages. The shell coordinates player choices and awards points after both game frames agree on the result.
- The result screen reads trainer names from the profiles and the final duel teams from the prepared fighters. It lists held-item labels carried into the duel. Scored Free Duo duels resume both AI runs from this screen; completed scheduled matches return to the home screen. Held-item effects and item actions are not currently simulated by the two-player duel engine.
- Profile captures are stored in the local capture bank and are copied into a duel when selected; the source capture remains available afterward.

The 2P setup and profile shell is currently French-only. The game inside each frame reads its language preference from that player's profile-scoped storage. When no preference has been saved, the game's normal language detection uses the Android WebView/browser locale, which follows the phone's language.

## Android runtime details

| Area | Implementation |
| --- | --- |
| Web content | `WebViewAssetLoader` serves assets at `https://appassets.androidplatform.net/assets/www/index.html`. The local HTTPS origin supports DOM storage and media; the app does not use `file://`. |
| Network | The app does not request the Android Internet permission. External links open in the browser. |
| Navigation | Only the bundled asset host is loaded in the WebView. `file:`, `intent:`, `javascript:`, and other navigation schemes are blocked. |
| JavaScript bridge | No `addJavascriptInterface` bridge is registered. |
| Backgrounding | The activity pauses WebView timers and the game. Saves and match progress are in localStorage; the 2P shell can resume an interrupted match. |
| Orientation | Solo mode can rotate; the 2P shell is portrait-only. The activity handles configuration changes without recreation. Phaser is notified when the viewport changes size. |
| Screen bounds | System bars are hidden with `WindowInsetsControllerCompat` and can be revealed with a system gesture. The canvas remains inside the visible window area. |
| Data | WebView localStorage is stored in the app's private internal data. It is not shared between installations or synced to the website. |

The tracked APK is a debug build. Do not upload it to an app store as a release package.

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
- To re-encode background music after updating assets: `ffmpeg`, `ffprobe`, and the `libmp3lame` encoder.

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
pnpm build:app
./android/build-apk.sh
```

The `assets` submodule is pinned to this fork's `android-compressed-bgm` branch, which already contains all 178 background tracks at 32 kbit/s or lower. A fresh checkout can build the compact APK directly. If you update the assets and want to reduce any new high-bitrate tracks, run `./android/compress-bgm.sh` before `pnpm build:app`; this optional step requires FFmpeg and FFprobe and changes the submodule working tree. The source audio can be restored with `git -C assets restore audio/bgm`.

The web build must exist before Gradle packages it. To install the debug build on a connected device, run:

```bash
./android/build-apk.sh installDebug
```

The APK is saved as `android/apks/PokeRogue-Android-2Players.apk`. `prepareWww` copies `dist/` (without source maps) and the 2P shell, including its GBA-style setup screen, into `android/app/src/main/assets/www/`. That generated directory is ignored by Git.

## Background audio assets

The checked-in assets submodule already supplies 178 background tracks at 32 kbit/s or lower. The build uses those files directly and does not package an extra high-quality copy. The optional compression script leaves files already at or below 32 kbit/s unchanged.

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

The setup, profile, and shared pause/quit controls follow the language preference of the last solo profile opened from `solo.html` by default. The launcher records either `local2p/v1/shell/solo-language-scope/v1 = profile:<id>` or `= solo`; `2p-i18n.js` then reads that profile's `prLang` or the unscoped solo `prLang`. If no saved preference is available, the shell maps the Android WebView locale to one of the game's 24 supported languages and falls back to English. The language dropdown on the J1 setup screen can override this choice; its selection is saved in `local2p/v1/shell/language/v1`, and choosing Automatic returns to the solo/phone preference. The game inside each frame still reads `prLang` from that player's profile-scoped storage, so P1 and P2 can use different languages.

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

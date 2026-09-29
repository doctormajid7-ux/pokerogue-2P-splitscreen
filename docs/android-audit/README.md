<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# Android implementation notes

These reports preserve the technical decisions made while adding Android and local two-player support. Each report is a snapshot of a development stage; old “remaining work” lists do not override the current player guide, changelog, or build notes.

## Current verified state

- The web app build completed with the 178 background tracks encoded at 32 kbit/s or lower.
- TypeScript type checking and JavaScript syntax checks completed successfully.
- The Android Gradle build completed successfully. The resulting debug APK is `PokeRogue-Android-2Players.apk`, 228,848,298 bytes (about 218.3 MiB).
- The APK was installed successfully on a connected Android phone on 2026-09-29. Its two launcher labels are **PokéRogue** and **PokéRogue 2Players**.
- The app was not opened after installation for a full gameplay check. Offline play, save recovery, screen rotation, and a complete two-player duel still need hands-on confirmation on the installed build.

## Rebuilding the compact APK

The Android fork pins `assets` to the `android-compressed-bgm` branch of [`doctormajid7-ux/pokerogue-assets`](https://github.com/doctormajid7-ux/pokerogue-assets), where the 178 background tracks are already stored at 32 kbit/s or lower. Initialize submodules with `git submodule update --init --recursive`, then run `pnpm build:app` and `./android/build-apk.sh`. No audio conversion is needed for a fresh checkout. If assets are updated with higher-bitrate tracks, `./android/compress-bgm.sh` can re-encode them before the web build; that optional step requires FFmpeg and FFprobe and leaves tracks already at or below 32 kbit/s unchanged. The A1 report below remains a historical snapshot of the original, uncompressed asset checkout.

The player-facing documentation is in [English](../../android/README.md) and [French](../../android/README.fr.md). Build instructions are in [DEVELOPMENT.md](../../android/DEVELOPMENT.md), and the user-facing changes are in the [changelog](../../android/CHANGELOG.md).

## Reports

- [A1 — Offline build and asset audit](./A1-offline-audit.md)
- [A2 — Android application](./A2-android-shell.md)
- [B1 — Per-player storage](./B1-player-storage.md)
- [B2 — Split-screen shell and touch input](./B2-two-player-shell.md)
- [B3 — Match setup and profiles](./B3-shell-config.md)
- [C1 — Match coordinator](./C1-block-coordinator.md)
- [C2 — Duel snapshots](./C2-duel-snapshots.md)
- [D1 — Duel engine](./D1-duel-engine.md)
- [D2 — Full-team duel](./D2-full-team-duel.md)

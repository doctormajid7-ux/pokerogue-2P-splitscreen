<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# Android changelog

This changelog lists changes in this Android adaptation compared with the original browser version of PokéRogue.

## Android app

- Added an Android app with separate **PokéRogue** (solo) and **PokéRogue 2Players** launchers.
- Bundled the game and its resources so it can be played offline.
- Added full-screen display and responsive framing that follows the phone's size and orientation without restarting a game.
- Added two-finger pinch zoom in solo mode. The game fits the available width in portrait and landscape.
- Improved phone touch controls: larger touch targets and separate saved layouts for portrait and landscape.

## Profiles and progress

- Added local profiles that players can create, name, customize, and select as P1 or P2.
- Added profile deletion with two confirmation steps; saves, settings, captures, and statistics for that profile are removed together.
- Kept saves, settings, and progress separate for each profile.
- Added the option to continue profile progress in solo mode while keeping the older solo save separate.
- Kept profiles, match statistics, Pokédex entries, and duel captures on the phone without online synchronization.

## Two-player mode

- Added two isolated games shown at once in a portrait split screen: P1 at the bottom and P2 at the top, rotated for the player sitting opposite.
- Added **Free Duo** for separate AI runs, **Block Match** for AI progress followed by shared duels, and **Random Quick Battle** for an immediate computer-generated duel.
- Added quick battle choices for fully random Pokémon with equal levels, or balanced teams with a random or selected common level.
- Added scored duels on demand in Free Duo.
- Added settings for battles per block, number of blocks, capture-bank replacements, and duel level balancing. Duo Free hides the block-only settings.
- Styled the two-player setup screen with the game's GBA-inspired pixel font, framed windows, and menu buttons. The battle screens continue to use the original animated game scenes.
- Clarified in the setup screen how many AI battles and shared duels each match requires, and how scoring works.
- Added a shared pause, match recovery after an interruption, score tracking, and local result history.
- Added a result screen after scored duels and completed matches, showing the winner's profile name, both Pokémon teams with their game sprites, and each player's trainer skin. Held items carried into the duel are listed; their effects are not active yet. In Free Duo the screen returns players to their AI runs; at the end of a scheduled match it returns to the home screen.
- Kept player duels in the game's battle scene with its sprites, animations, health bars, and messages. Attacks resolve one at a time.
- Added the normal **Struggle** fallback when a duel Pokémon has no usable PP, including its recoil damage.
- Added a local capture bank for duel preparation and removed the fixed 96-entry limit. Its practical capacity depends on the app's local browser storage quota.
- Localized the solo profile picker and all two-player shell screens—including progress and waiting messages, duel controls, reinforcement choices, the result screen, and pause/quit controls—in all 24 languages supported by the game. Automatic mode follows the most recently opened solo profile's language, or the phone's language when that profile has none. A setup-screen dropdown can choose a shared shell language, which also applies to the profile picker. Each game screen continues to follow its own profile language.
- Restored the normal B touch-button size in solo portrait mode.
- Fixed a delayed waiting message that could cover the start of a duel turn after both players had chosen. Turn failures now report their cause to the shell so an interrupted duel can be retried.
- Matched duel move-announcement timing to the game's normal battle-message delay and retained the player's manual message-clear setting.
- Fixed duel pause/resume so its timeout and final-turn display timer stop while paused and continue with their remaining time after resume.
- Corrected the localized duel-round and point labels, kept parked-player status consistent, and prevented the result card from flickering during dashboard updates.
- Showed experimental Pokémon sprite atlases on the result screen whenever the game setting enables them, with the same bounded path validation used for duel snapshots.

## Follow-up corrections and validation

- Added the separate `dashboardDuelRound` label to all 24 two-player locales instead of reusing the duel-button text. Corrected Ukrainian and Tagalog point labels and matched the English **ready** and **paused** labels to the shell's lowercase style.
- Kept parked-frame status derived from the frame's parked flag while preserving the readiness checks used to start quick-battle team generation. Removed the unreachable Spanish locale fallback branch.
- Prevented result-card flicker by skipping redraws when its summary and language have not changed, and by filling the card before showing it. Replaced sorting all animation frames with selecting the first-numbered frame directly.
- Made the result screen use experimental and variant sprite atlases when enabled, with the same bounded atlas-path validation used by duel snapshots.
- Updated the duel-snapshot expectation for the `heldItems` field already captured for duel fighters.
- Added nine shell regression tests for language resolution and precedence, profile and phone fallbacks, language-choice persistence, translation coverage, safe sprite paths, and validator parity. The ninth case confirms that an explicit shell-language choice takes precedence over the active solo profile.
- Verified the follow-up build with **229/229 system tests**, TypeScript and JavaScript typechecks, Biome, and `ls-lint` on the changed files.

## Audio and app size

- Played one background music track for both players while keeping battle sound effects active in both halves.
- Kept retrying audio unlock on player input until each frame's audio context is running, avoiding a lost first unlock attempt during startup.
- Re-encoded the 178 background MP3 tracks at 32 kbit/s or lower. The corresponding originals were replaced; sound effects and other media were not reduced.
- In the measured build, the APK size fell from about **530 MiB** to **218 MiB**, a reduction of about **312 MiB** (nearly **59%**). Exact size can vary by build.

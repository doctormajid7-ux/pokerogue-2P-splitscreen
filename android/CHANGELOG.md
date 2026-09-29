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
- Added a result screen after scored duels and completed matches, showing the winner's profile name, both duel teams, and held items carried into the duel. In Free Duo it returns players to their AI runs; at the end of a scheduled match it returns to the home screen. Held-item effects and item actions are not yet part of two-player duels, and the screen says so.
- Kept player duels in the game's battle scene with its sprites, animations, health bars, and messages. Attacks resolve one at a time.
- Added the normal **Struggle** fallback when a duel Pokémon has no usable PP, including its recoil damage.
- Added a local capture bank for duel preparation and removed the fixed 96-entry limit. Its practical capacity depends on the app's local browser storage quota.
- Localized the two-player setup and profile menus in all 24 languages supported by the game. They follow the language preference of the most recently opened solo profile, or the phone's language when no preference is saved; a setup-screen dropdown can override this. Each game screen continues to follow its own profile language.
- Fixed a delayed waiting message that could cover the start of a duel turn after both players had chosen. Turn failures now report their cause to the shell so an interrupted duel can be retried.
- Added the game's return/send-out messages when a player switches Pokémon during a duel and slightly increased the move announcement pause.

## Audio and app size

- Played one background music track for both players while keeping battle sound effects active in both halves.
- Kept retrying audio unlock on player input until each frame's audio context is running, avoiding a lost first unlock attempt during startup.
- Re-encoded the 178 background MP3 tracks at 32 kbit/s or lower. The corresponding originals were replaced; sound effects and other media were not reduced.
- In the measured build, the APK size fell from about **530 MiB** to **218 MiB**, a reduction of about **312 MiB** (nearly **59%**). Exact size can vary by build.

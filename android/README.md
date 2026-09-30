<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# PokéRogue for Android

This guide is for players. The Android app contains the PokéRogue game and can run without an internet connection. It offers a solo launcher and a separate two-player launcher for two people sharing one phone. Save data and profiles stay on that phone.

Read this guide in [French](./README.fr.md). For changes in this Android build, see the [changelog](./CHANGELOG.md).

## Install the app

Android 7.0 or newer is required, along with Android System WebView and working graphics acceleration. If the app reports that a required feature is missing, update **Android System WebView** from the Play Store and reopen the game.

If you received an `.apk` file:

1. Copy it to the phone or download it on the phone.
2. Open it from **Files** or **Downloads**.
3. If Android asks, temporarily allow that app to install applications, then return to the installer.
4. Tap **Install**, then open **PokéRogue** or **PokéRogue 2Players**.

Both launchers are included in one installation. Use **PokéRogue** for solo play and **PokéRogue 2Players** for two players. The APK distributed by this project is named `PokeRogue-Android-2Players.apk`; download it from the [Android releases page](https://github.com/doctormajid7-ux/pokerogue-2P-splitscreen/releases).

## Play solo

Open **PokéRogue**. You can continue the usual solo save or choose a profile created in two-player mode. A profile uses the same game progress in both modes, so you can advance alone and continue with that progress in a two-player match. The older solo save remains separate.

The game adjusts its view when the phone rotates. In portrait it fits the screen width; in landscape it uses the available width. Pinch with two fingers to adjust the zoom. The zoom returns to its normal setting after an orientation change.

Touch controls can be changed in the game's settings. Move them away from important parts of the screen. Portrait and landscape layouts are saved separately.

## Play two players on one phone

Open **PokéRogue 2Players** and hold the phone upright between the players. Player 1 (P1) uses the bottom half. Player 2 (P2) uses the top half, rotated 180 degrees so the player sitting opposite can read it. The setup screen uses the game's pixel font, framed windows, and menu styling. Each player has a separate profile, save data, settings, touch controls, and game progress. The middle bar contains the shared pause and quit buttons.

Each person touches only their own half. Battles use the game's usual battle scene, Pokémon sprites, animations, health bars, and messages. During a player duel, both players choose an action and the attacks are played one at a time.

The solo profile picker and all two-player menus, status messages, duel controls, and result screens are translated into all 24 game languages. In Automatic mode, they follow the language used by the most recently opened solo profile; if it has no saved preference, they use the phone's language. A language dropdown on the two-player setup screen can save a different shared shell language, which is also used by the picker the next time it opens. Inside each game screen, the language comes from that player's selected profile, so the two players can use different game languages.

### Game modes

- **Free Duo**: each player plays their own game against the AI and progresses at their own pace. Enable **Allow a duel in Free Duo (for points)** to show a shared Duel button. A duel starts when both games reach a safe point; its winner receives one point in their profile.
- **Block Match**: both players progress against the AI in separate games. After each block, they meet for a shared duel. If one player finishes first, that player waits. Player 1 chooses the number of battles in a block and the number of blocks.
- **Random Quick Battle**: play one duel immediately with two computer-made teams of six Pokémon. **Fully random** draws different Pokémon for both teams and gives all twelve the same randomly chosen level from 1 to 100. **Balanced teams** asks the computer to pair Pokémon of similar base strength. For this option, choose one common level or let the game choose a random level. This mode starts no AI battles and does not change solo progress.

In **Battles in a block**, the number includes the duel. A block of 10 means that each player wins 9 battles against the AI, then both play one duel. With 3 blocks of 10, each player wins 27 AI battles and the players share 3 duels. Each duel victory is worth one point; AI victories advance the game but do not change the score between players. **Number of blocks** is also the number of planned duels.

At the start of a match, Player 1 chooses the settings and Player 2 confirms with **Ready**. Both players must confirm before the games start. If Android closes the app during a match, the home screen offers to resume it.

After a scored duel, the result screen shows the winning trainer's profile name, both Pokémon teams with their game sprites, and each player's trainer skin. It also lists the items carried into the duel. In Free Duo, choose **Resume games** to return to both AI runs; at the end of Block Match or Random Quick Battle, choose **Return home**. Items cannot be used in two-player duels yet, so the screen explains that their effects are inactive.

## Profiles and saved progress

Each half of the two-player home screen has a profile button. From it, you can load a profile, change its name, icon, or colour, or create a new profile. The same profile cannot be loaded by both players at once.

Each profile keeps its own saves, settings, Pokémon progress, and statistics. Data stays inside the app on this phone; it is not sent to an online account. Clearing app data or uninstalling the app can remove these saves. Android backup is disabled for the app.

To remove a profile, open its menu and choose **Delete this profile**. Two confirmation steps are required because its saves, settings, captures, and statistics will all be erased. If the other player has loaded that profile, first switch them to another profile.

To play solo with a profile's progress, open **PokéRogue** and choose that profile on the selection screen. To continue two-player progress, choose the same profile in the P1 or P2 half. The older solo save is a separate choice.

## Capture bank and duel settings

Captures from a two-player game are added to that profile's bank. They can be chosen as replacements when preparing a duel. The bank has no fixed 96-Pokémon limit. Its practical limit is the local storage quota available to the app and browser engine. The solo Pokédex remembers species and whether they were caught. The two-player bank also stores each captured Pokémon so it can be selected for a duel.

In **Block Match** settings:

- **Captured Pokémon as reinforcements** lets each player replace up to 0, 1, 2, or 3 team members with Pokémon from their bank before a duel. A selected Pokémon is copied into the duel team and stays in the bank afterward, regardless of the result.
- **Pokémon levels** can use **Automatic balancing** or **Keep current levels**. Automatic balancing sets a shared level ceiling based on the less advanced team, rounded down to a multiple of 5. For example, if the teams' highest levels are 41 and 32, the ceiling is 30. This changes duel levels only; saved levels are not changed.

The bank belongs to a profile, so P1 and P2 captures are kept separate. The duel ceiling is about Pokémon levels, not the number of duels. In Block Match, the number of duels comes from the number of blocks.

## Sound and internet connection

The game and its resources are included in the app, so it can be played offline. Progress stays on the phone and is not automatically synchronized with the website, another phone, or an online account. Background music is encoded at 32 kbit/s or lower to reduce the download size; battle sound effects remain available. In two-player mode one background music track plays while sound effects from both battles remain active.

For build instructions, see [Android development notes](./DEVELOPMENT.md).

<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# B2 — Coque écran partagé et entrées tactiles

Livrable de la mission B2 de `docs/android-2p-plan.md` : « coque portrait, rotation J2, entrées dédiées ».
Condition de passage : « deux parties PvE simultanées sans mélange d'entrées » → **démontré en navigateur** (voir §Vérifications) ; l'essai multi-contacts sur appareil reste à faire.

## Ce qui est livré

| Élément | Rôle |
| --- | --- |
| `android/shell/2p.html` | Accueil 2P (configuré par J1, validé par J2 — refondu par B3, voir `B3-shell-config.md`) puis arène : J2 en haut, J1 en bas |
| `android/shell/2p.css` | Deux moitiés égales, **rotation 180° de la moitié haute**, marges système, cibles ≥ 48 px |
| `android/shell/2p.js` | Lancement, pause commune, protocole coque↔cadres, diagnostics |
| `android/app/src/main/java/org/pokerogue/app/TwoPlayerActivity.kt` | Entrée Android dédiée, verrouillée en portrait |
| `src/system/shell-protocol.ts` | Enveloppe et validation des messages (versionnée) |
| `src/system/shell-bridge.ts` | Pont côté jeu : gel/reprise, libération des entrées |
| `app/build.gradle` (`prepareShell`) | Copie reproductible de la coque dans `assets/www/shell/` |

La coque est une **entrée séparée du jeu solo** : deux icônes sont installées (« PokéRogue » et « PokéRogue 2Players »), la seconde en portrait verrouillé. L'écran d'accueil 2P reprend les cadres, la police pixel et les boutons inspirés du style GBA du jeu ; les combats gardent la scène animée habituelle.

## Décision d'architecture : la frontière du cadre *est* le routeur d'entrées

Le plan décrivait (au lot B) deux pistes possibles : router `pointerId` par joueur dans **un seul** document, ou isoler chaque partie dans son propre cadre de même origine. L'isolation par cadres a été retenue dès l'architecture cible ; elle rend le routage d'entrées structurel plutôt que calculé :

- un doigt qui appuie dans la moitié J2 est livré au **document J2** et y reste jusqu'au relâchement, même s'il traverse la ligne de partage (propriété du modèle d'événements, pas une convention) ;
- la rotation CSS de la moitié haute s'applique aussi à la résolution des coordonnées : les contrôles tactiles du jeu reçoivent des coordonnées locales cohérentes, donc **aucune inversion de vecteur n'est nécessaire** (contrairement à un montage où un même document porte deux pavés) ;
- chaque cadre garde son propre `PlayerStorage` (`local2p/v1/j1/`, `local2p/v1/j2/`) : sauvegardes, réglages, positions des contrôles tactiles et langue sont déjà séparés par le lot B1.

Conséquence : `touch-controls.ts` et `inputs-controller.ts` **n'ont pas eu à être modifiés** pour le multi-joueur. Les adaptations prévues au plan (actions typées par joueur) deviendraient nécessaires seulement si les deux joueurs partageaient un document.

## Protocole et pause commune

Enveloppe minimale versionnée (`protocolVersion`, `type`, `matchId` optionnel, `scope` en retour). Un cadre n'accepte un message que si **l'origine est la sienne, la source est sa fenêtre parente, la version est connue et le type est implémenté** ; la validation est dans `shell-protocol.ts` et testée unitairement.

Pause commune : la coque envoie `shell/pause` / `shell/resume` aux deux cadres ; le pont appelle alors `game.loop.sleep()` / `wake()` et `game.sound.pauseAll()` / `resumeAll()`, et libère les touches maintenues via `inputController.loseFocus()` (le chemin que le jeu utilise déjà quand il perd le focus). Rien d'autre n'arrête la boucle de jeu : Phaser ne suspend que le son sur perte de focus.

Un cadre annonce `frame/ready` au chargement et répond `frame/paused` / `frame/resumed` ; la coque affiche `J1 · prêt` / `J2 · prêt` et se fie à ces réponses plutôt qu'à ses propres suppositions. Chaque cadre libère ses entrées sur `pagehide`, `blur` et `visibilitychange` — utile quand Android suspend la page sans préavis.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Deux parties lancées simultanément | Les deux cadres répondent `frame/ready` |
| Paramètre de joueur | `location.search` = `?player=j1` / `?player=j2` dans chaque cadre |
| **Isolation du stockage** | Le `localStorage` partagé contient `local2p/v1/j1/prLang` **et** `local2p/v1/j2/prLang`, chacun écrit par son cadre ; la clé solo `prLang` reste intacte |
| Rotation J2 | Vérifiée à l'écran : moitié haute retournée, repères J1/J2 lisibles pour chacun |
| Pause / reprise | Aller-retour complet : `frame/paused` puis `frame/resumed` reçus des **deux** cadres |
| `pnpm typecheck` / `biome check` | OK |
| Tests | 6 tests de protocole ajoutés ; suite complète **455 fichiers, 3 111 tests** OK |
| APK | Construit (533 Mio) : `assets/www/shell/` présent, manifeste avec `MainActivity` (`fullSensor`) et `TwoPlayerActivity` (`portrait`), deux entrées de lanceur |

Deux bugs réels ont été attrapés par ce test navigateur : l'attribut `hidden` neutralisé par `display: flex` (les deux écrans restaient empilés), et un ordre d'import hors convention Biome.

## Reste à faire

1. **Validation matérielle** : deux parties PvE simultanées, 2/4/6/8 contacts réels, gestes longs, passage en arrière-plan — la coque affiche l'état des cadres, `logcat -s PokeRogueShell` donne la taille du viewport.
2. **Règle audio** : deux pistes musicales jouent en même temps. À trancher (musique d'une seule session par défaut, ou musique commune) et à implémenter dans le pont, à côté de la pause.
3. **Petits écrans** : le mode d'agrandissement n'est pas implémenté ; la coque se contente d'un style compact sous 640 px de haut.
4. **Seuil de duel** : il est configuré et persisté (`local2p/v1/shell/rules`) mais rien ne le consomme encore — c'est le rôle du coordinateur (lot C1).
5. Le cadre J2 et le cadre J1 partagent le même `localStorage` : surveiller le quota quand deux profils complets cohabitent.

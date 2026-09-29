<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# B3 — Accueil 2P et configuration du match

Mission B3 de `docs/android-2p-plan.md`, sur les règles décidées dans
`docs/android-2p-game-modes.md` : J1 configure le match à blocs, les deux joueurs
en voient le récapitulatif et le match ne part qu'après leurs deux accords.

Le **tableau de bord d'arène** (bloc, compteur de combats, points de duel par
moitié) et la **reprise d'un match interrompu** ont été livrés avec le
coordinateur du lot C1 : voir `C1-block-coordinator.md`. Restent l'écran de profil
(lot E) et l'envoi effectif des règles aux cadres (protocole v2).

## Ce qui est livré

| Élément | Rôle |
| --- | --- |
| `src/system/match-rules.ts` | `MatchRulesV1`, bornes, validation stricte, normalisation, dérivation du planning (`matchSchedule`) |
| `test/tests/system/match-rules.test.ts` | 19 tests : bornes, enums, migration, bornage, planings limites |
| `android/shell/2p.html` | Accueil en deux moitiés : configuration dans celle de J1, récapitulatif retourné et « Prêt » dans celle de J2 |
| `android/shell/2p.css` | Partage 34 % / 66 % à l'accueil (J2 n'a qu'un récapitulatif et un bouton), panneau défilable, styles de champs |
| `android/shell/2p.js` | Lecture/écriture des règles, récapitulatif partagé, double accord, migration de l'ancien seuil |
| `android/shell/match-coordinator.js` | Coordination des blocs et journal reprenable (lot C1) |

## Modèle de données

`MatchRulesV1` : `mode` (`side-by-side` | `blocks`), `blockSize` (2–99),
`blocks` (1–20), `bankRenforts` (0–3), `levelCap` (`auto` | `none`),
`duelOnDemand`, le tout en version 1. Le module est la seule autorité sur les
bornes côté jeu ; la coque en recopie la table (elle est du JavaScript
autonome, sans étape de compilation) et **les deux se vérifient mutuellement**
via le récapitulatif : le test navigateur a confirmé `3 blocs de 10 → 27 + 3 =
30` des deux côtés.

`matchSchedule()` matérialise la décision « le duel clôt le bloc » :
`pvePerBlock = blockSize - 1`, `pveBattles = pvePerBlock × blocks`,
`duels = blocks + manches supplémentaires`, `totalBattles = pveBattles + duels`.
Trois blocs de 10 font donc 27 + 3 = 30. En mode `side-by-side`, tous les
compteurs valent zéro plutôt qu'une valeur trompeuse.

## Migration et robustesse

- L'ancien format `{ threshold }` (« un duel toutes les N victoires PvE ») est
  migré en un bloc de `N + 1` combats, qui décrit le même match : la clé
  `local2p/v1/shell/rules` d'une installation précédente reste donc lisible. Le
  module TypeScript le fait pour les cadres, la coque pour elle-même.
- Une configuration hors bornes est **ramenée dans ses bornes**, un champ
  illisible ou un enum inconnu retombe sur la valeur par défaut, et un
  `localStorage` non analysable donne les valeurs par défaut avec un
  avertissement. `isMatchRules()` reste strict, pour ne pas confondre « à
  normaliser » et « corrompu ».
- Le formulaire doit représenter fidèlement les règles stockées : un contrôle de
  cohérence le vérifie au chargement et journalise un écart éventuel.

## Deux pièges attrapés en vérifiant

1. **`<select>` sans option correspondante.** Une valeur valide mais absente de
   la liste courte du formulaire (ici `blockSize = 6`, issue de la migration du
   seuil) faisait retomber le `<select>` sur `""`, et `Number("")` vaut `0` :
   les règles affichées devenaient `2` alors que le stockage disait `6`, sans
   aucune erreur visible. Corrigé par `setSelectValue()`, qui insère l'option
   manquante à sa place numérique, et par un `clamp()` qui traite une chaîne vide
   comme inutilisable au lieu de zéro.
2. **Accord périmé.** J1 peut modifier un réglage après avoir appuyé sur
   « Prêt » : tout changement annule les deux accords, sans quoi J2 lancerait un
   match qu'il n'a pas lu.

## Vérifications réellement exécutées

| Contrôle | Résultat |
| --- | --- |
| `pnpm exec vitest run test/tests/system/match-rules.test.ts` | 19 tests passés |
| `pnpm test` | 456 fichiers, 3 130 tests passés (455/3 111 avant) |
| `pnpm typecheck` | OK |
| `pnpm exec biome check` (fichiers touchés) | Un seul avertissement, celui du `[hidden] { display: none !important }` assumé depuis B2 |
| Navigateur : `dist/shell/2p.html` (Chromium, 412×915) | Défauts `Duo libre` champs éteints ; mode `Match à blocs` → récapitulatif « 3 blocs de 10 → 27 combats IA + 3 duels = 30 » ; J1 seul ne lance rien ; un changement de réglage annule l'accord ; les deux accords lancent les deux cadres (`?player=j1|j2`, 343×406 chacun, `frame/ready` reçu des deux) ; `local2p/v1/j1/prLang` et `j2/prLang` toujours écrits séparément ; règles relues au rechargement |
| Navigateur : robustesse | `{threshold: 5}` → bloc de 6 combats, option insérée dans la liste ; `blockSize 500 / blocks 999 / levelCap "fixed"` → 99 / 20 / `auto` ; valeur non JSON → valeurs par défaut |

## Reste à faire

1. **Bouton de duel à la demande** dans la barre centrale : décrit et
   configurable, il attend le moteur de duel (lot D).
2. **Écran de profil** (lot E1) et renforts de banque (E2).

L'envoi des règles aux cadres, qui était le premier point restant, est livré avec
le protocole v2 (voir `C1-block-coordinator.md`) : la coque répond `shell/rules`
au `frame/ready` de chaque cadre, avec les règles figées du match en cours.

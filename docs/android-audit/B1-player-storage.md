<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# B1 — Stockage par joueur (`PlayerStorage`)

Livrable de la mission B1 de `docs/android-2p-plan.md`.
Condition de passage : « J1/J2 survivent séparément à un arrêt forcé » → l'isolation est **prouvée en test unitaire** ; l'essai « deux cadres + arrêt forcé » relève du lot B2, qui n'existe pas encore.

## Ce qui est livré

`src/system/player-storage.ts` — la **porte unique** vers `localStorage` :

| Élément | Rôle |
| --- | --- |
| `SCOPE_ROOT = "local2p/v1"` | Racine versionnée des clés scopées (un futur format se migre ici) |
| `PLAYER_PARAM = "player"` | Paramètre d'URL désignant le joueur d'un cadre |
| `scopeFromQuery(search)` | Lecture validée (`^[a-z0-9_-]{1,32}$`) ; sans paramètre ou invalide → solo |
| `PlayerStorage` | `getItem` / `setItem` / `removeItem` / `hasItem` / `keys` / `clear` / `scopeKey` |
| `playerStorage` | Instance du joueur courant, résolue au chargement du module |

Schéma des clés : `local2p/v1/<joueur>/<clé historique>`, par exemple
`local2p/v1/j1/data_Guest`. **Sans paramètre `player`, le préfixe est vide** et les
clés gardent exactement leurs noms historiques — aucune sauvegarde existante ne
bouge, aucune migration destructive n'est nécessaire.

## Refactor : tous les accès directs relevés puis redirigés

Aucun `localStorage.` direct ne subsiste dans `src/` (vérifié par recherche).

| Fichier | Clés / usages redirigés |
| --- | --- |
| `src/system/game-data.ts` | `data_<user>`, `sessionData<n>_<user>`, `runHistoryData_<user>`, `daily`, `tutorials`, `seenDialogues`, `mappingConfigs` |
| `src/account.ts` | contrôle du dernier slot, migration héritée `data` / `sessionData<n>` (désormais scopée) |
| `src/utils/data.ts` | `starterPrefs_<user>` |
| `src/system/settings/settings-manager.ts` | `settings` |
| `src/system/version-migration/version-converter.ts` | réécriture des `settings` migrés |
| `src/system/version-migration/versions/v1_12_1_0.ts` | `settingsGamepad`, `touchControlPositions*`, `touchControl/positions/*`, `starterPrefs_<user>` |
| `src/ui/settings/move-touch-controls-handler.ts` | `touchControl/positions/<orientation>` |
| `src/ui/handlers/login-register-info-container-ui-handler.ts` | énumération des sauvegardes (`Object.keys(localStorage)` → `playerStorage.keys()`) |
| `src/i18n.ts` | `prLang` (i18next écrit lui-même : il reçoit `scopeKey("prLang")`) |

Détails de fidélité au comportement d'origine :

- `Object.hasOwn(localStorage, key)` remplacé par `hasItem`, sémantique identique ;
- `keys()` n'expose que le scope courant (les autres joueurs et les clés solo sont invisibles) ;
- `clear()` ne supprime que le scope courant.

## Tests ajoutés

`test/tests/system/player-storage.test.ts` (10 tests) : clés solo inchangées, lecture
d'une sauvegarde écrite avant ce wrapper, préfixe versionné, isolation J1/J2,
impossibilité de toucher les clés solo, `keys()` filtré, `clear()` scopé,
`hasItem` (clé absente vs valeur vide), `scopeFromQuery` (valide et invalide).

`test/mocks/mock-local-storage.ts` a dû être rendu **fidèle à l'interface `Storage`**
(`length`, `key(index)`, `getItem` renvoyant `null`) : le stub précédent gardait les
clés dans une closure et répondait `undefined`, ce qui rendait toute énumération
fausse dans les tests.

## Vérifications exécutées

| Commande | Résultat |
| --- | --- |
| `pnpm typecheck` | OK |
| `biome check` (fichiers modifiés) | OK (formatage appliqué) |
| `vitest run` (player-storage, game-data, account) | 18 tests OK |
| `pnpm test` (suite complète) | **453 fichiers, 3 101 tests** OK, 8 fichiers ignorés — 238 s |

## Hypothèses

- La coque 2P chargera chaque partie dans un cadre de **même origine** dont l'URL porte
  `?player=j1` / `?player=j2` (chemins relatifs, comme prévu au plan) ; sans paramètre,
  le mode solo est strictement inchangé.
- `sessionStorage` et `indexedDB` ne sont pas utilisés par le jeu : il n'y a rien
  d'autre à cloisonner (vérifié par recherche).

## Reste à faire (B2)

1. Deux cadres simultanés et **arrêt forcé de l'application** : vérifier que J1 et J2
   reprennent chacun sur leur progression.
2. Surveiller le **quota** de `localStorage` : deux profils complets (sauvegardes +
   historique + préférences) cohabitent désormais dans le même espace.
3. Le lot B2 devra confirmer que la purge d'un joueur (`clear()`) n'est jamais
   déclenchée par l'autre.

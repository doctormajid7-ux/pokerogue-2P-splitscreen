<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# A1 — Audit du build hors ligne

Livrable de la mission A1 de `docs/android-2p-plan.md` : carte des ressources, des accès API et du stockage, SHA et tailles de build.
Objectif de passage : **aucun appel réseau requis pour démarrer et jouer en solo**.

## 1. Reproductibilité

| Élément | Valeur |
| --- | --- |
| Branche de travail | `android/solo-shell` (créée depuis `beta`) |
| SHA amont documenté | `8f267c227435512309e12e9398aca33d9442e3d6` (`refactor: rework and fix DoT and Trapping BattlerTags (#6662)`) |
| Sous-module `assets` | `87426a79611f9d212c4dc8af58e2834a05b93725` (épinglé, inchangé) |
| Sous-module `locales` | `3229684c2c7a39ce5c8e61ec1e9ecde8ab426925` (épinglé, inchangé) |
| Node | v24.9.0 (conforme à `.nvmrc`) |
| pnpm | 10.34.5 via Corepack (conforme à `packageManager`) |
| Vite | 8.2.2 (`vite build --mode app`) |

Commandes exécutées lors de l'audit initial : `pnpm install --frozen-lockfile` (343 paquets, OK), `pnpm build:app` (OK, 16,6 s, 2 745 modules, 14 241 JSON minifiés). Le manifeste ci-dessous et les chiffres de cette section sont le relevé de cette première version, avant la compression des musiques.

## 2. Tailles du build (`dist/`)

| Métrique | Valeur |
| --- | --- |
| Taille brute | **762 Mio** |
| Nombre de fichiers | **33 910** |
| Estimation gzip -9 (concaténation) | **521 027 053 octets ≈ 497 Mio** |
| SHA-256 du manifeste de fichiers | `572689bf90b17af803743ee09ed08dedaeb2628b6a1d49e154889e980ddec00e` |

L'estimation gzip sert de borne pour la compression APK (déflate) ; les médias (png, m4a, mp3, mp4) sont déjà compressés et ne gagnent quasiment rien. La mesure initiale de l'APK figure dans le rapport A2 ; la taille après encodage des musiques est indiquée dans le [changelog](../../android/CHANGELOG.md) et l'index d'audit.

Répartition de `dist/` :

| Dossier / type | Taille | Contenu |
| --- | --- | --- |
| `audio/` | 443 Mio | 1 335 m4a, 1 221 wav, 178 mp3 (cris, BGM, SE) |
| `images/` | 238 Mio | 16 862 png (Pokémon, UI, arènes, objets) |
| `battle-anims/` | 27 Mio | animations de combat |
| `assets/` (JS+CSS+maps) | 35 Mio | 20 chunks JS, 1 CSS, 16 source maps |
| `locales/` | 15 Mio | 14 242 JSON (33 langues + `mystery-encounters`) |
| `fonts/` | 7 Mio | 5 ttf (+ `item-count.xml`) |
| racine | ~15 Kio | `index.html`, `service-worker.js`, `manifest.webmanifest`, `asset-manifest.json`, logos |

Plus gros chunks JS : `loading-scene` 2,6 Mio, `sprite-set` 1,2 Mio, `index` 1,2 Mio, `battle-scene` 956 Kio.
Malgré `publicDir: false` en build, les ressources `assets/` et `locales/` **sont bien copiées** dans `dist/` par le plugin `minify-public-json-files` : `dist/` est autonome.

Le manifeste exhaustif par fichier a été retiré du dépôt : c'était un relevé généré pour ce build historique, inutile à la compilation ou à la maintenance. Les tailles et constats synthétiques utiles sont conservés dans ce rapport.

Fichiers non web copiés par erreur depuis les sous-modules (à exclure de la copie Gradle du lot A2) : 18 `*.bat`, 3 `*.ps1`, 3 `*.tps` (projets TexturePacker), présents sous `dist/images/**`. `dist/fonts/item-count.xml` est à vérifier avant exclusion (peut servir au bitmap font).

## 3. Accès réseau

Aucun `WebSocket`, `EventSource` ni `sendBeacon` dans `src/`. Trois utilisations de `fetch()` :

| Fichier | Usage | Comportement hors ligne |
| --- | --- | --- |
| `src/api/api-base.ts` | `pokerogueApi` → `VITE_SERVER_URL` | Échec ; branches API suivantes |
| `src/init/init-manifest.ts` | `fetch("/manifest.json")` (**chemin absolu**) | Absent du build, échec silencieux dans un `try/catch` (« Manifest not found (likely local build…) ») |
| `src/utils/fetch-utils.ts` | `cachedFetch` (i18n et JSON) | Relatif, servi par les fichiers embarqués |

API exposée par `pokerogueApi` (compte, `savedata.system|session`, `daily`, `admin`, `getGameTitleStats`) :
- `VITE_BYPASS_LOGIN=1` dans `.env.app` : pas de login, pas de synchro serveur attendue.
- `title-phase.ts` : la graine du *daily run* n'est demandée que si `!bypassLogin || isLocalServerConnected`, sinon génération locale par date → **OK hors ligne**.
- `localPing()` (`getGameTitleStats`) n'est appelé qu'en dev (`isDev`).
- OAuth Discord/Google et handlers login/register/admin : non atteints en mode bypass.

Autres URLs (`VITE_WIKI_URL`, Discord, GitHub, Reddit, donate) : simples liens `<a>`, pas de chargement.

**i18n** : `i18next-http-backend` charge `./locales/${lng}/${fileName}.json` (relatif, cache-busting `?t=` via `getCachedUrl`). Servi depuis `dist/locales/` → OK hors ligne.

**Conclusion : le démarrage et le jeu solo ne nécessitent aucun appel réseau**, sous réserve des corrections ci-dessous (chemin absolu `/manifest.json`).

## 4. Stockage local (inventaire des clés `localStorage`)

Base `getDataTypeKey` (`src/utils/data.ts`) + suffixe compte :

| Clé | Contenu | Fichier |
| --- | --- | --- |
| `data_${username}` (+ `_bak`) | sauvegarde système, chiffrée AES (`crypto-js`) | `system/game-data.ts`, `account.ts` |
| `sessionData${slotId}_${username}` | sessions de partie | `account.ts` (`getSessionDataLocalStorageKey`) |
| `runHistoryData_${username}` | historique des runs | `system/game-data.ts` |
| `starterPrefs_${username}` | préférences de starters | `utils/data.ts` |
| `settings` | réglages (SettingsManager) | `system/settings/settings-manager.ts` |
| `tutorials`, `seenDialogues`, `mappingConfigs` | tutoriels, dialogues vus, mappings manette | `system/game-data.ts` |
| `daily` | seed du daily run | `system/game-data.ts` |
| `prLang` | langue (i18next LanguageDetector) | `i18n.ts` |
| `settingsGamepad` | réglages manette (lu/migré) | `system/version-migration/versions/v1_12_1_0.ts` |
| `touchControl/positions/landscape-primary`, `.../portrait-primary` | positions des contrôles tactiles | migration v1_12_1_0 |
| `touchControlPositionsLandscape/Portrait` | anciennes clés migrées puis supprimées | migration v1_12_1_0 |

À noter pour le lot B1 (`PlayerStorage`) : les clés sont **partagées par origine** ; le préfixage `local2p/v1/j1|j2/` devra couvrir la totalité de cette liste, y compris `prLang` et les clés de migration.

## 5. Points d'attention pour A2 (coque Android)

1. `fetch("/manifest.json")` en chemin absolu : à passer en relatif ou à supprimer en mode app (non bloquant mais bruit réseau).
2. `base: ""` : tous les chemins de `index.html` et du bundle sont relatifs (`./logo512.png`, `./manifest.webmanifest`, `./locales/...`) → compatible `WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/www/index.html`).
3. Les polices (`./fonts/*.ttf`) sont résolues au runtime (warning Vite attendu) et présentes dans `dist/fonts/` → OK.
4. `service-worker.js` est minimal (`install` + `clients.claim()`, pas de cache) : inutile dans la WebView, à désactiver pour éviter toute surprise.
5. `manifest.webmanifest` et `asset-manifest.json` : inoffensifs, inutiles hors navigateur.
6. Médias : majoritairement `.m4a` (bien supporté par la WebView) ; quelques `.wav`/`.WAV` et 2 `.mp4` (fond d'écran de titres ?) à tester sur appareil.
7. L'APK de debug final mesure environ 218 Mio après encodage des 178 musiques de fond ; la mesure initiale et les limites de validation sont récapitulées dans `docs/android-audit/README.md`.

## 6. Vérifications exécutées

- `pnpm install --frozen-lockfile` : OK (lockfile respecté).
- `pnpm build:app` : OK (16,6 s).
- `pnpm typecheck` : OK (aucune erreur).
- `pnpm test` : OK — 452 fichiers de tests passés, 8 ignorés ; 3 091 tests passés, 6 ignorés, 111 todo (217 s).

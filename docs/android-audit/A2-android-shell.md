<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# A2 — Application Android

Livrable de la mission A2 de `docs/android-2p-plan.md` : projet Gradle, APK debug, script de construction, documentation.
Condition de passage : « partie solo et sauvegarde relancées sur téléphone » → l'APK a été compilé et installé sur un appareil Android connecté le 29 septembre 2026. Une partie complète et une reprise de sauvegarde n'ont pas été vérifiées sur cette dernière version.

## Contenu livré

| Élément | Emplacement |
| --- | --- |
| Projet Gradle (AGP 8.7.3, Kotlin 2.1.0, Gradle 8.13) | `android/` |
| Activity Kotlin + WebViewAssetLoader | `android/app/src/main/java/org/pokerogue/app/MainActivity.kt` |
| Manifeste (aucune permission) | `android/app/src/main/AndroidManifest.xml` |
| Script de construction | `android/build-apk.sh` |
| Documentation + checklist de validation | `android/README.md` |
| Icônes (générées depuis `dist/logo512.png`) | `android/app/src/main/res/mipmap-*/` |

## Résultat de build

| Métrique | Valeur |
| --- | --- |
| Commande | `./android/build-apk.sh` (`:app:assembleDebug`) |
| APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Taille APK compressée actuelle** | **228 881 355 octets ≈ 218,3 Mio** |
| Première taille mesurée avant compression audio | 555 813 109 octets ≈ 530 Mio |
| Contenu décompressé du premier build | 676 102 409 octets, 33 944 fichiers |
| Fichiers `assets/www/` | 33 894 (dist/ 33 910 – 16 source maps exclues) |
| Paquet | `org.pokerogue.app`, `versionName 1.12.1.0`, minSdk 24, targetSdk 35 |
| Réseau | **pas de permission Internet** ; AndroidX ajoute une permission privée de protection interne |

Le transcodage des 178 musiques de fond à 32 kbit/s ou moins a ramené l'APK de 555 813 109 octets à 228 881 355 octets : environ 312 Mio économisés (58,8 %). Le premier build d'environ 530 Mio incluait les musiques d'origine ; les valeurs exactes sont données dans le tableau.

## Choix notables

- **`prepareWww` (Gradle Sync)** : copie reproductible `dist/` → `app/src/main/assets/www/`, source maps exclues, échec tôt avec la commande à lancer si `dist/` est absent. Branchée sur `preBuild` **et** `merge*Assets` pour éviter qu'un build en une passe n'empaquette un `www` périmé.
- **`WebViewAssetLoader`** : `https://appassets.androidplatform.net/assets/www/index.html` exactement comme demandé par le plan ; DOM storage actif ; `file://` et accès fichiers désactivés.
- **Navigation** : seul l'hôte d'assets dans la WebView, liens externes → navigateur, autres schémas bloqués ; aucun pont JavaScript.
- **Sondage de capacités** (WebGL, localStorage, Web Audio) à la fin du chargement avec écran d'erreur natif + « Réessayer ».
- **Arrière-plan** : `pauseTimers()`/`onPause()` (Phaser `pauseOnBlur` gère l'audio) ; la progression étant en localStorage, un arrêt brutal du processus ne perd rien.
- **Retour Android** : historique sinon `moveTaskToBack` (session conservée).

## Corrections rencontrées lors du build

- `java` système = JRE sans `javac` : le script dérive désormais `JAVA_HOME` de `javac` (JDK 17 présent dans `/usr/lib/jvm/java-17-openjdk`).
- `WebSettings.supportZoom()` n'a pas de getter « get » : assignation Kotlin impossible, remplacée par `setSupportZoom(false)`.
- **Rotation** : trois états successifs.
  1. Activité conservée + relance de l'échelle de la WebView (`setInitialScale(0)` puis `requestLayout` et `resize` synthétique) : sans effet. Diagnostic trop large à l'époque — « la géométrie de la fenêtre reste figée ».
  2. Repli : laisser Android **recréer l'activité** (`configChanges="keyboardHidden|uiMode"`). Le viewport repartait proprement, mais la page se rechargeait à chaque rotation : **le jeu redémarrait**, en repartant de la dernière sauvegarde.
  3. Cause réelle trouvée : `useWideViewPort = true` + `loadWithOverviewMode = true` font calculer une échelle initiale *au chargement* et la figent ensuite. Au retournement, la WebView se remet bien en page, mais le document garde l'échelle de l'orientation précédente — contenu plus large que la zone visible, donc « zoomé et coupé » ; aucun appel à `setInitialScale` après le chargement ne la recalcule. Or `index.html` déclare déjà `width=device-width, initial-scale=1.0` : les deux options sont inutiles ici et désormais **désactivées**, le viewport suit la taille de la WebView. L'activité survit donc de nouveau à la rotation (`configChanges` absorbe `orientation|screenSize|screenLayout|smallestScreenSize`), et la partie en cours ne redémarre plus.
  Les drapeaux `systemUiVisibility` (bord-à-bord sous des barres réapparues, d'où le rendu coupé) restent remplacés par `WindowInsetsControllerCompat`, décor non bord-à-bord.
- **Filet de sécurité du viewport** (`MainActivity.checkViewport`) : après un changement de configuration, la page est interrogée (`innerWidth`/`innerHeight` × `devicePixelRatio` contre `WebView.width`/`height`, tolérance 3 % ou 8 px) et le rapport « zone visible / viewport de mise en page » détecte le rognage. Premier écart → remise en page + `window.resize` (Phaser recadre son canvas) ; écart persistant **et** rognage → rechargement, seul cas où la page repart. Chaque étape laisse une trace `viewport …` dans `logcat -s PokeRogueShell`, et la sonde échoue ouvert (rien n'est conclu si la page ne répond pas).
- **Texture manquante à l'écran-titre** (carré noir à liseré vert) : `SceneBase.loadImage` / `loadSpritesheet` construisaient `images//logo.png` (segment vide pour les assets rangés à la racine : `logo`, `logo_fake`, `snow`). Un navigateur et un serveur de développement effacent ce double slash, l'`AssetManager` d'Android le refuse et le sprite retombe sur la texture « image manquante » de Phaser. Corrigé par l'aide `assetPath()` (`src/utils/asset-path.ts`), désormais utilisée par les deux chargeurs ; `loadAtlas` connaissait déjà la règle. Vérifié de bout en bout : 0 requête malformée après correction (contre 3 avant), et 4 tests de régression.
- Sondage de capacités toujours faux négatif sur appareil : `evaluateJavascript` renvoie son résultat sérialisé en JSON, la string `JSON.stringify(...)` revenait donc échappée et les tests de sous-chaînes ne matchaient jamais (les trois capacités étaient déclarées manquantes à tort, masquant une page saine). Corrigé : la sonde renvoie un objet, Kotlin parse le JSON (`org.json`) et **échoue ouvert** — un sondage illisible ne bloque plus le jeu.

## Reste à faire (étape 5 du lot A + suivis)

1. Sur la dernière version installée, vérifier en jeu le mode avion, une partie et sa sauvegarde/reprise, le redémarrage après arrêt forcé, le français, le son, l'orientation, l'encoche et les gestes système. Relever mémoire/FPS/`logcat`.
2. `fetch("/manifest.json")` (chemin absolu du build web) : requête morte en local, à neutraliser si le bruit logcat gêne.
3. Mesure mémoire/FPS des deux scènes Phaser exigée après B2 — le principal risque du projet.

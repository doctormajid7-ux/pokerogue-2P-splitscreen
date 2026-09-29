# Plan de portage Android et de jeu local à deux

> Note de conception : ce document garde les décisions et étapes du port initial. Le code actuel dans `android/` et le [guide joueur](../android/README.md) décrivent le comportement livré ; certains lots ci-dessous sont donc historiques ou déjà réalisés.

## Contrat du projet

Ce document décrit une version **locale sur un seul appareil Android**, tenu en portrait entre deux personnes face à face. La moitié inférieure appartient à J1 ; la moitié supérieure appartient à J2 et pivote de 180°. Chacun joue sa propre progression contre l'IA. Chaque partie se découpe en **blocs** configurés par J1 (un parcours contre l'IA terminé par un duel J1 contre J2) ; le premier joueur arrivé à une frontière attend le second. Après le duel, les deux progressions PvE reprennent. Une défaite PvP n'efface pas la progression PvE. Les profils joueurs persistent les statistiques, le dex et les Pokémon capturés, qui peuvent renforcer l'équipe de duel.

> Les règles de jeu (modes, blocs, profils, banque, contrats de données) sont
> détaillées dans [`android-2p-game-modes.md`](./android-2p-game-modes.md), qui
> remplace la règle provisoire « un duel toutes les cinq victoires PvE par
> joueur » : ce seuil devient un cas particulier d'une configuration par blocs.

Ces règles sont le périmètre initial à implémenter ; leur changement ultérieur doit passer par la configuration du mode, sans modifier les combats classiques. Le PvP utilise une **copie** des équipes à la frontière : équipe soignée pour le duel, niveaux ramenés au plafond commun du palier, attaques/évolutions acquises conservées, objets consommables et capture/fuite désactivés. Les PV, statuts, objets et récompenses du duel ne sont pas réinjectés dans les sauvegardes PvE. Le gagnant reçoit un point de duel dans le profil local. Une égalité ou une interruption relance le duel depuis son instantané. Cela évite qu'un combat PvP détruit par le système Android corrompe une progression.

Les deux joueurs sont sur le **même téléphone**. Aucun compte distant, serveur public, Bluetooth ou synchronisation entre appareils n'est requis. « Connecter les données » signifie ici relier deux sessions isolées par un coordinateur local, avec messages typés. Une extension réseau serait un projet ultérieur avec autorité serveur et règles anti triche distinctes.

## État du dépôt examiné

- Projet TypeScript, Phaser 3, Vite ; scripts `build:app`, `typecheck`, `test` dans `package.json`. Version Node et pnpm fixées dans `.nvmrc` et `package.json`. `assets` et `locales` sont des sous-modules Git.
- Les sous-modules occupent environ **816 Mio pour `assets`** et **17 Mio pour `locales`** dans cette copie. `vite.config.ts` met `publicDir: false` pendant la compilation : ne pas supposer que `dist/` contient automatiquement ces ressources. La taille de l'APK et les chemins de chargement sont un risque majeur dès le port solo.
- `.env.app` active déjà `VITE_BYPASS_LOGIN=1`. `src/system/game-data.ts` lit et écrit la progression et les sessions dans `localStorage` en mode hors ligne. Le build « app » n'est **pas** un projet Android : aucun dossier Android n'est livré dans ce dépôt.
- Contrôles tactiles existants : `index.html`, `index.css`, `src/touch-controls.ts`, `src/inputs-controller.ts`. Ils émettent des commandes vers les événements Phaser, sans identité de joueur. Un exemple antérieur de jeu Android à écran partagé utilise aussi une page WebView, deux contrôleurs tactiles et une moitié supérieure tournée de 180°. Un jeu de plateforme SDL fournit des exemples utiles pour les contacts multiples ; son moteur ne se transplante pas ici.
- Simulation actuelle : `src/globals/global-scene.ts` exporte une scène singleton ; `src/battle-scene.ts` porte la partie et l'équipe du joueur ; `src/battle.ts` porte les commandes des combattants ; `src/phases/command-phase.ts` reçoit le choix humain ; `src/phases/enemy-command-phase.ts` choisit pour l'IA. `src/phases/victory-phase.ts` et `src/phases/battle-end-phase.ts` terminent les combats. `src/@types/save-data.ts` et `src/system/pokemon-data.ts` donnent les formats de sauvegarde et de Pokémon.
- Une partie double existante signifie deux Pokémon de chaque côté du **même combat** ; elle ne représente pas deux joueurs indépendants. Un simple ajout à `GameModes` ou un second `BattleScene` dans la même page entrerait en conflit avec le singleton et les autres états globaux.

## Architecture cible

```text
Application Android (Kotlin, WebViewAssetLoader)
  └─ page coque locale, portrait 2P
      ├─ vue J2 tournée de 180° ─ session PvE isolée J2
      ├─ coordinateur local ─ seuils, sauvegardes, duel
      └─ vue J1 ─ session PvE isolée J1
                         ↓ à la frontière
               moteur de duel autoritaire local
                 ↙ état public  ↘ état public
                UI J1 privée    UI J2 privée
```

**Isolement PvE.** Deux documents web enfants (`iframe`) de même origine chargent chacun leur propre instance Phaser. Chaque document possède son propre singleton JavaScript. Ils partagent toutefois `localStorage` par origine : introduire un adaptateur de stockage `PlayerStorage` avec préfixes `local2p/v1/j1/` et `local2p/v1/j2/` pour toutes les clés de sauvegarde, réglages, tutoriels et préférences. Ne pas faire un remplacement global implicite de `localStorage` : relever d'abord toutes les clés et refactoriser les accès au travers d'une interface explicite. Garder les clés du mode solo à leur place. Les iframes doivent utiliser le même domaine HTTPS local et des chemins relatifs. Mesurer le coût mémoire et la cadence de deux Phaser/WebGL simultanés sur le téléphone cible avant de poursuivre ; si l'appareil ne tient pas deux scènes, garder un seul document actif à la fois ou refactoriser les singletons en contextes par joueur avant le PvP.

**Coordinateur.** La coque garde une machine d'états `SETUP → PVE → WAITING → DUEL_PREPARE → DUEL → DUEL_RESULT → PVE` et un journal local versionné. Les messages `postMessage` comportent `protocolVersion`, `matchId`, `playerId`, `seq`, `type`, `payload`. Vérifier origine, source du message, état courant, numéro croissant et schéma du payload. Utiliser des identifiants opaques et ne jamais faire confiance à une valeur `wins` envoyée librement : le signal de victoire vient uniquement de l'adaptateur de fin de combat de la session concernée. Le coordinateur exige un accusé de réception de la sauvegarde de chaque session avant d'ouvrir le duel.

**Duel.** Une seule simulation fait autorité pour les PV, effets, RNG, ordre de vitesse, capacités et victoire. Les deux interfaces recueillent les commandes, mais aucune ne calcule séparément les dégâts. Le premier jalon PvP peut afficher le même champ de bataille public sur les deux moitiés, la moitié haute étant tournée, et des menus de commande privés par joueur. Le champ public peut être copié visuellement ; il ne doit pas exposer le menu ou le choix non validé de l'autre joueur. Une vraie perspective inversée de chaque équipe est un jalon graphique ultérieur. Les données privées (choix de commande, éventuelle information cachée) ne sont envoyées qu'à leur vue.

**Modèles de référence examinés.** Un exemple de jeu Android à écran partagé a permis de comparer la configuration WebView, l'origine HTTPS locale et le verrouillage portrait. Un exemple SDL a permis d'étudier les contacts multiples et la capture des pointeurs. Ces modèles servent à comprendre les interactions tactiles ; ils ne remplacent pas l'architecture de PokéRogue. Ici, chaque joueur garde une progression séparée contre l'IA, puis partage un duel local. La duplication visuelle d'un canvas n'échange pas les Pokémon, les sauvegardes ni les choix de combat.

## Lot A — APK solo Android

1. Créer une branche `android/solo-shell`. Documenter le SHA amont et garder les sous-modules à leurs commits épinglés. Installer la version Node demandée par `.nvmrc`, activer Corepack/pnpm demandé par `package.json`, puis `pnpm install --frozen-lockfile` et `pnpm build:app`.
2. Inventorier les ressources générées dans `dist/`, les requêtes absolues, imports dynamiques, JSON, langues, polices, sons, workers éventuels et appels vers l'API. En particulier, déterminer quelles parties de `assets/` et `locales/` le build doit copier car Vite ne le fait pas via `publicDir`. Produire un manifeste de fichiers et hashes, conserver les noms/chemins attendus et mesurer la taille **avant et après compression APK**. Pour le premier démarrage hors ligne, empaqueter l'ensemble nécessaire ; seulement ensuite réduire par ressources réellement inutilisées, format/compression ou packs installables. Ne pas baser un APK dit hors ligne sur un téléchargement obligatoire au premier lancement. Corriger les chemins pour un chargement intégral depuis une origine locale. Éviter d'embarquer les secrets ou les paramètres d'authentification distants dans l'APK local.
3. Ajouter `android/` avec une `Activity` Kotlin, un `WebView` accéléré matériellement et `androidx.webkit.WebViewAssetLoader`. Charger le build empaqueté avec `https://appassets.androidplatform.net/assets/www/index.html` ; activer JavaScript et DOM storage, interdire la navigation arbitraire hors de l'application et n'exposer aucun pont JavaScript général. Copier `dist/` dans `app/src/main/assets/www/` par tâche Gradle reproductible. Configurer icône, version, signature debug, orientation et retour Android. Garder les données privées dans le stockage interne de l'app.
4. Au lancement, vérifier WebGL, audio et stockage. Prévoir écran d'erreur clair si le WebView du téléphone n'a pas les capacités nécessaires. Couper le son en arrière-plan, restaurer après retour et gérer l'arrêt du processus. En mode solo, conserver les contrôles tactiles du jeu et rendre lisibles les dialogues et menus sur la taille réelle du téléphone.
5. Valider sur appareil : installation, démarrage sans réseau, nouvelle partie, plusieurs combats, sauvegarde/reprise, arrêt forcé/reprise, français, son, orientation, encoche, gestes système. Relever mémoire, FPS, temps de lancement, taille APK et `logcat`. Ne déclarer le port fonctionnel qu'après cette validation matérielle.

## Lot B — coque écran partagé et entrées tactiles

1. Ajouter une page de coque distincte du menu solo : écran d'accueil 2P, seuil de duel, lancement, pause commune et reprise. En portrait, donner à chaque joueur une moitié égale **après** prise en compte des marges système ; diviser chaque moitié en zone de rendu et commandes. Dimensionner à partir de `visualViewport`, de la densité et des insets ; proposer une taille minimale des cibles tactiles et un mode d'agrandissement pour petits écrans.
2. Faire tourner le conteneur J2 de 180° par CSS avec `transform-origin: center`. Laisser le hit testing des boutons suivre la transformation CSS, mais inverser explicitement le vecteur du D-pad (`dx = -dx`, `dy = -dy`) avant de décider la direction. Pour tout contrôle qui utilise des coordonnées locales du canvas, appliquer la transformation inverse du conteneur, puis vérifier les coins et les bords. Une rotation visuelle ne doit pas transformer le propriétaire du contact.
3. Dans chaque vue, router `pointerId`/`Touch.identifier` vers son joueur **à l'appui initial**. Garder cette propriété jusqu'au relâchement, même si le doigt traverse la ligne centrale. Chaque joueur a ses états de touches et ses répétitions. Relâcher tout sur `cancel`, `blur`, `visibilitychange`, pause Android, rotation ou destruction de la vue. Empêcher zoom, défilement et menu contextuel dans la zone de jeu. Vérifier les actions simultanées des deux côtés ; ne pas envoyer les touches J2 au contrôleur J1.
4. Adapter `src/touch-controls.ts` et `src/inputs-controller.ts` pour injecter des actions typées par joueur, sans générer de faux événements clavier globaux. Réutiliser la disposition existante comme point de départ, puis créer une disposition réduite et propre à chaque demi-écran. Prévoir validation, retour, menu, direction, changement d'équipe et sélection des attaques. Ajouter un repère visuel J1/J2 et une pause commune, hors des cibles de combat.
5. Démontrer deux parties PvE isolées sur un appareil. Chaque joueur démarre, choisit, attaque, sauvegarde et reprend sans agir sur l'autre. Vérifier 2, 4, 6 et 8 contacts réels selon la capacité du téléphone, les gestes longs et le passage en arrière-plan. Mesurer les deux scènes ensemble ; une capture vidéo ne suffit pas à valider les entrées indépendantes. Prévoir le mixage des sons des deux sessions, un volume par joueur et une règle simple à tester (par défaut musique commune ou musique d'une seule session, effets des deux joueurs) afin d'éviter deux pistes musicales concurrentes.

## Lot C — progression commune et sauvegarde transactionnelle

1. Définir `MatchStateV1` : `matchId`, `rulesVersion`, les règles figées, `block`, `phase`, `extraDuels`, `players[{playerId, saveSlot, pveInBlock, pveTotal, duelWins, ready, lastSavedSeq}]`, `duelSnapshotId`, horodatage — les règles de jeu sont celles de `docs/android-2p-game-modes.md`. Stocker ce journal séparément des deux `SessionSaveData`. Écrire de façon atomique : version provisoire + checksum, puis marqueur de validation ; au redémarrage choisir la dernière version valide.
2. Brancher l'événement `PVE_BATTLE_WON` après conclusion effective d'un combat gagné (`VictoryPhase`/`BattleEndPhase`) et après mise à jour de la sauvegarde. Dédupliquer avec `matchId + playerId + battleId` ; un redémarrage ou la répétition d'une phase ne doit pas ajouter deux victoires. Décider et afficher clairement si une capture/fuite/rencontre mystère compte : pour la version initiale, seule une victoire de combat conclue compte, sauvage ou dresseur.
3. À la frontière du bloc (`pveInBlock == blockSize - 1`), marquer le joueur `ready` et arrêter son avancement **entre** deux combats, après récompense et sauvegarde. Afficher « En attente de l'autre joueur » avec sa progression. L'autre continue. Quand les deux sont `ready`, sauvegarder les deux sessions, créer les instantanés d'équipe et entrer dans `DUEL_PREPARE` ; après le duel validé, `block++` et `pveInBlock = 0`.
4. L'instantané PvP contient `rulesVersion`, `matchId`, `round`, la liste `PokemonData` validée de chaque équipe, leurs capacités/attaques/PP, les objets autorisés et un hash de contenu. Ne transmettre ni l'ensemble du profil, ni une référence mutable vers la session PvE. Rejeter équipe vide, données corrompues, espèce/attaque non chargée et versions incompatibles. Garder les sauvegardes PvE intactes.
5. Après résultat confirmé : écrire `duelWins`, remettre `pveInBlock` à zéro, avancer `block`, supprimer l'instantané provisoire uniquement après validation du journal, puis réactiver les deux vues PvE. Au redémarrage en `WAITING`, reprendre l'attente ; en `DUEL_PREPARE` ou `DUEL`, reconstruire le duel depuis l'instantané stable ; en `DUEL_RESULT`, réafficher le résultat sans recompter la victoire.

## Lot D — moteur PvP vertical puis complet

1. Ajouter un type de rencontre `LOCAL_DUEL` séparé des rencontres sauvages et dresseurs classiques. Garder les règles originales hors de ce mode. Extraire les éléments qui dépendent de `globalScene` derrière un `BattleContext` passé explicitement au moteur de duel, ou construire un adaptateur PvP limité autour d'une seule scène autoritaire. Ne pas dupliquer toute la logique de dégâts dans une seconde implémentation : les mécaniques devraient rester communes au PvE et au PvP.
2. Première coupe fonctionnelle : un Pokémon par joueur, `FIGHT` seulement, quatre attaques, sans changement, objets, capture ni fuite. `EnemyCommandPhase` ne doit plus appeler `getNextMove()` dans un duel ; il attend le choix J2. `CommandPhase` attend J1. Le tour ne se résout qu'une fois les **deux** commandes valides reçues ou après une règle de délai local explicite. Les choix sont masqués jusqu'au verrouillage des deux côtés.
3. Alimenter `Battle.turnCommands`/`preTurnCommands` avec le même format typé pour les deux camps, puis utiliser le résolveur existant pour priorité, vitesse, RNG, dégâts, capacités, statut et K.O. Publier `turnStart`, `choicesLocked`, `turnResolved`, `duelEnded` avec `turnId` et hash d'état. Une commande en double ou d'un vieux tour est rejetée. Sauvegarder une graine RNG de duel et les décisions pour reproduire les défauts.
4. Étendre aux équipes : changement manuel, remplacement après K.O., pièges, attaques ciblées, PP épuisés, Struggle, immunités, effets de terrain, météo, capacités et talents passifs. Auditer toutes les branches qui distinguent `PlayerPokemon` et `EnemyPokemon`, `playerParty` et `enemyParty`, les gains d'EXP, capture, argent, récompenses et fin de partie. Dans `LOCAL_DUEL`, neutraliser ou adapter ces branches explicitement. Ne jamais appeler la progression de vague PvE depuis `VictoryPhase` à la fin du duel.
5. Traiter la fin : équipe entièrement K.O., abandon explicite d'un joueur, égalité, suspension Android. Montrer résultat dans les deux vues, créditer une seule fois le gagnant dans le journal, restaurer les deux parties PvE depuis leurs sauvegardes et reprendre au prochain combat PvE. Ajouter ensuite la vraie perspective de terrain propre à chaque joueur si la vue publique initiale est trop peu lisible.

## Lot E — profils joueurs et banque de captures

1. Définir `ProfileV1` par joueur (`local2p/v1/<joueur>/profile/v1`) : identité, statistiques à vie, résumé du dex, banque de captures. Le profil est lié à la moitié d'écran et survit aux runs comme aux matchs ; le mode solo historique garde ses clés et n'a ni profil ni banque.
2. Alimenter la banque après une capture confirmée (espèce, forme, variante, niveau, talent, nature, attaques, origine) et le dex à chaque première rencontre. Mettre à jour les statistiques au même endroit que le compteur de bloc, après l'écriture de la sauvegarde du run, avec déduplication.
3. Conserver toutes les captures dans la banque sans plafond fixe, et trier les meilleurs exemplaires en tête. Le Pokédex conserve aussi les compteurs d'espèces ; surveiller le quota local et la taille de la liste des renforts.
4. Écran de profil par moitié : nom modifiable par son propriétaire, duels et matchs gagnés, combats PvE, dex, contenu de la banque. Aucun réseau.
5. Brancher les renforts de duel : à la préparation, un joueur remplace jusqu'à `bankRenforts` emplacements de son équipe par des entrées de sa banque ; l'entrée est copiée, jamais consommée.

## Contrat d'échange local recommandé

```ts
type Local2PMessage =
  | { type: 'PVE_BATTLE_WON'; playerId: 'j1' | 'j2'; battleId: string; saveSeq: number }
  | { type: 'PVE_SAVED'; playerId: 'j1' | 'j2'; saveSeq: number; snapshotHash: string }
  | { type: 'DUEL_READY'; playerId: 'j1' | 'j2'; snapshotId: string; snapshotHash: string }
  | { type: 'DUEL_COMMAND'; playerId: 'j1' | 'j2'; turnId: number; command: DuelCommand }
  | { type: 'DUEL_STATE'; turnId: number; publicState: DuelPublicState; stateHash: string }
  | { type: 'DUEL_RESULT'; duelId: string; winner: 'j1' | 'j2' | 'draw'; stateHash: string };
```

Ajouter à chaque message l'enveloppe `protocolVersion`, `matchId` et `seq`. `DUEL_STATE` est émis par le seul moteur autoritaire. Les types `DuelCommand` et `DuelPublicState` doivent être des schémas versionnés, validés à l'entrée ; ne pas envoyer directement des instances Phaser ou des classes `Pokemon`, qui ne traversent pas proprement `postMessage`.

> Les noms réellement implémentés suivent le style de la version 1 et non le
> CamelCase de ce bloc : `shell/rules`, `frame/pve-battle-won`, `frame/pve-saved`
> pour le lot C1 (voir `android-2p-game-modes.md`). Une seconde correction de ce
> contrat porte sur l'auteur du message : le cadre n'annonce jamais son
> identité, la coque déduit le joueur de la source du message.

## Missions à confier aux autres IA, dans cet ordre

| Mission | Livrable concret | Condition de passage |
| --- | --- | --- |
| A1. Audit du build hors ligne | Carte des ressources, accès API et stockage ; SHA et tailles de build | Aucun appel réseau requis pour démarrer et jouer en solo |
| A2. Coque Android | Projet Gradle, APK debug, script de construction, documentation | Partie solo et sauvegarde relancées sur téléphone |
| B1. Stockage par joueur | `PlayerStorage`, migration prudente, deux slots isolés | J1/J2 survivent séparément à un arrêt forcé |
| B2. Écran 2P tactile | Coque portrait, rotation J2, entrées dédiées | Deux parties PvE simultanées sans mélange d'entrées |
| B3. Accueil et tableau de bord | Sélecteur de mode, configuration J1, récapitulatif lisible des deux côtés, progression de bloc et score dans la barre centrale | Un match de 3 blocs de 10 affiche « 27 combats contre l'IA + 3 duels = 30 » avant lancement |
| C1. Coordinateur de match | Machine d'états `SETUP → BLOC → ATTENTE → PREPARE → DUEL → RESULTAT → FINI`, journal versionné, compteur de bloc, messages validés | Un duel se déclenche une seule fois par bloc, y compris après un arrêt forcé et une reprise |
| C2. Instantanés et renforts | Sérialisation d'équipes, plafond commun, emplacements de banque, reprise après crash | Aucune sauvegarde PvE altérée par un duel avorté ; duel reconstruit à l'identique |
| D1. Duel minimal | Choix simultanés et simulation autoritaire 1 contre 1 | Même résultat après reproduction des commandes et graine |
| D2. Duel complet | Équipes, changements, fin, score, reprise PvE | Deux cycles PvE → duel → PvE sur appareil |
| E1. Profil persistant | `ProfileV1` par joueur, banque alimentée par les captures, écran de profil | Deux profils survivent à un arrêt forcé ; dex et banque à jour après plusieurs matchs |
| E2. Duel de banque | Équipe choisie dans la banque, plafond appliqué | Un duel se joue avec des Pokémon capturés lors d'un match précédent |

Chaque IA travaille sur sa propre branche, annonce précisément les fichiers modifiés, les hypothèses et les commandes de vérification réellement exécutées. Faire intégrer A avant B, B avant C et C avant D ; le lot E (profils) est indépendant de C et D, et ne touche que l'espace de stockage du joueur et l'écran de profil ; un changement de protocole ou de format de sauvegarde doit être coordonné avant intégration. À chaque lot, vérifier `pnpm typecheck`, `pnpm test` sur les parties de logique concernées, `pnpm build:app`, puis installation et essai matériel dès qu'un APK existe. Les tests de simulation doivent contrôler le résultat et la reprise, pas simplement recopier le code testé. Mesurer la mémoire et la cadence sur le téléphone cible après B2 et D2 ; c'est le principal risque technique de deux scènes Phaser et d'une UI de duel.

## Points juridiques et de distribution

Le code amont est annoncé sous AGPL-3.0-only ; la documentation et certaines ressources ont d'autres licences, et les ressources sans licence explicite demandent un examen séparé. Conserver les notices et vérifier les droits sur les éléments Pokémon avant toute diffusion d'APK. Ce plan vise d'abord un prototype local ; la publication est une décision distincte.

## Références

- Modes de jeu et profils : [`android-2p-game-modes.md`](./android-2p-game-modes.md)
- Dépôt et licence : https://github.com/pagefaultgames/pokerogue
- Contenu local Android : https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- WebViewAssetLoader : https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader
- Insets WebView : https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets
- Référence d'architecture : documentation Android sur [WebViewAssetLoader](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader) et le contenu local sécurisé.
- Validation tactile : tester plusieurs contacts maintenus, déplacés, annulés et relâchés sur un appareil réel.

# D1 — Moteur de duel

Mission du plan : *« Choix simultanés et simulation autoritaire 1 contre 1 »*,
condition de passage : *« Même résultat après reproduction des commandes et
graine »*.

Livré et vérifié dans le navigateur sur deux vraies scènes Phaser, sans jamais
lire ni écrire une sauvegarde de run. La manche comptée nulle du lot C1 a
disparu : un duel de bloc se joue, se gagne et crédite un point.

## Ce que D1 fait, et ce qu'il ne fait pas encore

| Fait | Détail |
| --- | --- |
| Un Pokémon par joueur | chaque côté joue le **premier membre** de l'équipe préparée par C2 |
| `FIGHT` seul | les quatre attaques du Pokémon, aucune capture, fuite, objet ni changement |
| Choix simultanés masqués | chacun choisit dans sa moitié, personne ne voit l'autre avant le verrouillage des deux |
| Simulation autoritaire | la coque mène le tour ; elle n'applique un tour que si **les deux cadres**, qui l'ont résolu séparément, rendent la même empreinte |
| Graine dérivée | `duelSeedFor(duelId, empreintes des équipes)` : même duel, mêmes tours, même résultat |
| Dégâts | statistiques du jeu, tables d'attaques du jeu, tableau de types du jeu, STAB, critique (1/24), précision, ordre par priorité puis vitesse |
| Fin de duel | K.O., K.O. simultané (nul) ou limite de 100 tours (nul) — un seul point, crédité par le coordinateur |
| Reprise | un duel interrompu se rejoue à l'identique ; une manche qui n'a pas pu se jouer est nulle, jamais gagnée |

Ne sont **pas** simulés à ce stade (voir « Limites ») : talents, statuts, paliers,
météo, objets tenus, multi-coups, riposte, soins, effets propres à chaque attaque,
et les équipes de plus d'un Pokémon. `duel-mechanics.ts` est le seul fichier à
remplacer pour brancher la mécanique réelle du jeu ; l'engine, le protocole et la
coque n'ont pas à bouger.

## Livrables

| Fichier | Rôle |
| --- | --- |
| `src/system/duel-engine.ts` | Machine d'états d'un duel : état JSON-safe, générateur embarqué, verrouillage des choix, résolution **vérifiée**, empreinte par tour, rejeu |
| `src/system/duel-mechanics.ts` | Mécanique d'un tour, **provisoire et isolée** : ordre, précision, critique, dégâts |
| `src/system/shell-protocol.ts` | Messages du duel : `shell/duel-matchup`, `shell/duel-start`, `shell/duel-turn` ; `frame/duel-fighter` et `frame/duel-state` (état public **et** attaques du propriétaire) |
| `src/system/shell-bridge.ts` | Côté cadre : matérialisation du combattant depuis l'instantané, efficacités de type, ouverture du duel, résolution d'un tour, rapport d'état |
| `android/shell/duel-session.js` | Côté coque, **pur et testé** : appariement des deux rapports, accord des empreintes, choix masqués, ouverture d'un tour, graine, vues pour l'affichage |
| `android/shell/2p.js` | Conduite du duel : préparation croisée (types), ouverture, tours, bandeaux, garde-fou, sortie de secours |
| `android/shell/2p.html` / `2p.css` | Table de jeu, une par moitié : adversaire, soi, menu d'attaques, journal du dernier tour |
| `test/tests/system/duel-engine.test.ts` | 25 tests : ouverture, verrouillage, résolution vérifiée, K.O., nul, empreintes, rejeu |
| `test/tests/system/duel-mechanics.test.ts` | 16 tests : ordre, précision, dégâts, STAB, critique, rng |
| `test/tests/system/duel-session.test.ts` | 19 tests : session de la coque, et **comparaison avec l'engine TypeScript** sur les mêmes entrées |

## Déroulement d'une manche

```text
frontière atteinte (C1/C2)          les deux runs sont arrêtés, paquets de jeu figés
        │
        ├─ shell/duel-invite  ─────►  cadre : capture l'équipe de run (C2)
        │◄─ frame/duel-team
        ├─ shell/duel-prepare ─────►  cadre : plafonne, renforts, **matérialise**
        │◄─ frame/duel-ready            (niveau, types, stats, PV, attaques : le jeu)
        ├─ shell/duel-matchup ─────►  chacun reçoit les types de l'autre
        │◄─ frame/duel-fighter          et recalcule ses efficacités
        ├─ shell/duel-start ───────►  graine + les deux combattants
        │◄─ frame/duel-state (tour 0)   état public des deux camps
        │
        │   ┌── boucle du duel ───────────────────────────────────────────────┐
        │   │  J1 choisit (masqué)  J2 choisit (masqué)                       │
        │   ├─ shell/duel-turn (les deux choix, ensemble) ──►  deux cadres    │
        │   │◄─ frame/duel-state (tour n, empreinte, état public, attaques)   │
        │   │  accord des empreintes ?  → tour appliqué, journal révélé       │
        │   │  désaccord ?              → duel cassé, aucun point             │
        │   └─────────────────────────────────────────────────────────────────┘
        │
        ├─ dernier tour affiché (3,5 s), puis
        └─ recordDuelResult(duelId, winner)   le coordinateur crédite le point
           → bloc suivant ou FINI, les deux cadres relâchés (shell/continue)
```

## Décisions et leur raison

1. **La coque mène, les cadres calculent, l'accord tranche.** Aucun camp ne peut
   décider seul : l'engine du cadre vérifie la résolution qu'on lui rend (les PV
   ne remontent jamais, seul le PP de l'attaque utilisée bouge, personne ne se
   relève), et la coque n'applique un tour que si les deux empreintes sont
   égales. C'est la deuxième vérité qui protège de l'erreur, pas la première.
2. **Un choix verrouillé ne sort pas de la coque.** Il est stocké dans la
   session, la moitié concernée affiche « Attaque verrouillée » sans nommer
   l'attaque, l'autre moitié ne change pas d'un octet, et les deux attaques ne
   partent que dans le même `shell/duel-turn`. Aucun cadre ne connaît le choix de
   l'autre avant le dénouement.
3. **Les attaques privées voyagent avec le rapport, pas dans la vue publique.**
   `frame/duel-state` porte `view` (ce que les deux joueurs voient : PV, noms,
   types, qui a verrouillé) et `moves` (les attaques du propriétaire, pour **sa**
   moitié). `duelPublicState` ne contient aucune attaque : c'est vérifié par un
   test.
4. **La graine se dérive, elle ne se tire pas.** `duelSeedOf` (coque) et
   `duelSeedFor` (cadre) donnent le même entier pour les mêmes empreintes — un
   test compare les deux implémentations. Un duel repris depuis le journal rejoue
   donc exactement les mêmes tours, sans rien persister de plus.
5. **Le dernier tour reste à l'écran 3,5 s avant que le point soit crédité.**
   Sans cela, la table de jeu disparaîtrait au moment où le combat se décide. Le
   journal reste en `DUEL` pendant cette lecture : un arrêt à cet instant rejoue
   le duel au lieu de le perdre.
6. **Un duel cassé ne crédite personne.** Désaccord d'empreintes, cadre
   redémarré en plein duel, tour resté sans réponse (garde-fou de 6 s) : la
   manche est nulle (`recordDuelResult(duelId, "draw")`) et le bloc avance. Le
   prix de ne jamais compter deux fois.
7. **Une sortie de secours, mais seulement sur un échec constaté.** Le bouton
   « Duel impossible · manche nulle » n'apparaît que si une moitié a annoncé
   qu'elle ne pouvait pas construire son combattant, ou si un échange est resté
   sans réponse : une manche qui attend encore ses instantanés ne peut jamais
   être réglée par erreur.

## Vérifications

| Vérification | Résultat |
| --- | --- |
| `pnpm typecheck` | propre |
| `pnpm test` | **462 fichiers, 3 289 tests** passés (6 ignorés, 111 à faire) — dont 60 nouveaux pour D1 |
| `pnpm exec biome check` (fichiers touchés) | aucune erreur (reste l'avertissement `!important` assumé depuis B2) |
| `pnpm build:app` | ✓ |
| APK | `BUILD SUCCESSFUL`, `assets/www/shell/{2p.html,2p.css,2p.js,match-coordinator.js,duel-session.js}` inclus |
| Navigateur : préparation réelle | Deux cadres à la frontière, instantanés dans le journal, `shell/duel-prepare` → **le jeu** matérialise `Pikachu niv. 100 · 211 PV` (Tonnerre 15/15) et `Bulbizarre niv. 1 · 12 PV` (Charge 35/35) |
| Navigateur : types croisés | `shell/duel-matchup` envoyé aux deux, chaque cadre rend son `frame/duel-fighter`, la coque ouvre le duel (`DUEL`) et les deux tables de jeu s'affichent (jeux masqués) |
| Navigateur : choix masqué | J1 verrouille → sa moitié dit « Attaque verrouillée · en attente de l'autre joueur », la moitié de J2 est **inchangée au caractère près** et ne contient pas le nom de l'attaque ; aucun `shell/duel-turn` n'est parti |
| Navigateur : tour résolu | J2 choisit → les deux cadres résolvent séparément, empreintes égales → journal `J1 (Pikachu) utilise Tonnerre — 1119 dégâts · J2 (Bulbizarre) est K.O.` dans les **deux** moitiés, barre de PV à 0 % |
| Navigateur : point au bon moment | pendant les 3,5 s d'affichage, le journal est encore `DUEL` et le score **0–0** ; après, `FINI`, `outcome j1`, score **1–0**, match archivé |
| Navigateur : libération | les deux cadres reçoivent `shell/continue` (`waiting` faux), les jeux reviennent, tables et bandeaux effacés |
| Navigateur : duel cassé | rechargement d'un cadre en plein duel → avertissement « un cadre a redémarré pendant le duel », manche nulle, `FINI` sur `draw`, score **0–0** : aucun point n'est inventé |
| Tests unitaires | l'engine refuse une résolution qui soigne, qui invente des PP, qui touche une autre attaque ou qui parle d'un seul camp ; le rejeu rend les mêmes empreintes ; la session refuse un rapport d'un autre duel, d'un autre tour, un doublon, un désaccord |

## Limites connues

1. **Mécanique provisoire** : les talents, statuts, paliers, météo, objets tenus
   et effets propres aux attaques ne sont pas simulés (une attaque de statut ne
   fait rien). Les nombres, eux, viennent tous du jeu. Brancher `getAttackDamage`
   et la machinerie de combat réelle est le contenu de D2.
2. **Un Pokémon par joueur** : le reste de l'équipe préparée est ignoré. Ni
   changement, ni remplacement après K.O.
3. **Reprise en cours de duel** : après un redémarrage complet (page et cadres),
   C2 reconstruit le duel depuis le journal et D1 le **rejoue depuis son premier
   tour** — même graine, donc même résultat. Un cadre rechargé **seul**, pendant
   le duel, ne peut pas rejoindre une partie commencée : la manche est nulle.
4. **Objets tenus** : l'instantané ne les transporte pas (décision héritée de
   C2, à trancher en D2).
5. **Un duel à la demande** (hors score) n'est toujours pas jouable : le
   coordinateur n'a qu'un seul chemin vers un point, celui des duels de bloc.
6. **Validation matérielle** : la manche a été vérifiée en navigateur, avec deux
   vraies scènes Phaser, mais pas encore sur un téléphone (aucun appareil
   connecté) ; la mémoire et la cadence de deux scènes plus une table de jeu
   restent à mesurer.

## Suite

- **D2** : équipes complètes, changements, remplacement après K.O., et branchement
  de la mécanique réelle du jeu à la place de `duel-mechanics.ts`.
- **E1** : le profil et sa banque, qui alimentent les renforts de C2 et l'écran de
  préparation.
- **Duel à la demande** : le même moteur, ouvert depuis un bloc, hors score.

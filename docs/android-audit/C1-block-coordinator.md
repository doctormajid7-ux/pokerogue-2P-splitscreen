<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# C1 — Coordinateur de match et journal reprenable

Livrable de la mission C1 du plan, aux règles de `docs/android-2p-game-modes.md` :
compteur de bloc par joueur, frontière, attente de l'autre, sauvegardes accusées,
ouverture du duel, point crédité une seule fois, journal reprenable après un
arrêt.

**Le tableau de bord d'arène et la reprise au démarrage sont livrés avec** (B3),
**les cadres parlent au coordinateur en protocole v2** (règles reçues, combats
gagnés et sauvegardes annoncés), et **le jeu s'arrête réellement à la frontière
du bloc** : le joueur qui a fini son bloc voit son run se figer entre deux
combats, avec un bandeau lisible dans sa moitié, jusqu'au duel.

Ce qui reste est nommé en fin de page : le moteur de duel lui-même (lot D),
aujourd'hui remplacé par une manche comptée nulle.

Les **instantanés d'équipe** annoncés ici comme suite naturelle sont livrés
depuis : voir [`C2-duel-snapshots.md`](./C2-duel-snapshots.md), qui ajoute au
journal les deux équipes figées, le plafond commun et les renforts de banque.

## Ce qui est livré

| Élément | Rôle |
| --- | --- |
| `android/shell/match-coordinator.js` | Machine d'états pure, journal, empreinte, écriture provisoire/validée, reprise |
| `test/tests/system/match-coordinator.test.ts` | 25 tests : comptage, dédoublonnage, frontière, sauvegardes, duel, blocs, égalité, manche supplémentaire, journal abîmé, reprise |
| `android/shell/2p.js` | Seam `record()` : livrer un fait, écrire le journal, rafraîchir ; tableau de bord par moitié ; reprise depuis l'accueil |
| `android/shell/2p.html` | Repère de chaque moitié devenu tableau de bord, bouton **Reprendre le match** |
| `android/shell/2p.css` | Pastille de progression par moitié, mise en avant quand le duel est jouable |
| `src/system/shell-protocol.ts` | Protocole v2 : `shell/rules` descendante, `frame/pve-battle-won` et `frame/pve-saved` montantes, validation du motif de règles |
| `src/system/shell-bridge.ts` | Côté cadre : reçoit les règles, produit un identifiant de combat stable, compte les sauvegardes et les annonce |
| `src/phases/battle-end-phase.ts` | Rapport d'une victoire contre l'IA, à la conclusion effective du combat |
| `src/system/game-data.ts` | Accusé de sauvegarde de session, là où la sauvegarde est réellement écrite |
| `src/system/duel-park.ts` | Machine d'états de l'attente : armer, s'arrêter une fois, rendre la suite à la libération |
| `test/tests/system/duel-park.test.ts` | 7 tests : armement, arrêt unique, première suite conservée, libération, abandon |
| `src/phases/encounter-phase.ts` | Point d'arrêt sûr : la suite de la phase est remise au pont au lieu d'être exécutée |
| `android/shell/2p.js` | Annonce de la frontière, bandeaux d'attente par moitié, libération après un duel |

## Décision : le coordinateur est un module ES, pas du code recopié

Le coordinateur tourne dans la **page coque** (c'est elle qui tient le journal,
comme le prévoit le plan), mais il n'est pas pour autant condamné à être
intestable : `match-coordinator.js` est un module ES autonome, importé à la fois
par la page (`<script type="module">`) et par les tests unitaires. Une seule
implémentation, donc un seul comportement possible entre ce qui est testé et ce
qui tourne. C'est la réponse au compromis qui avait été accepté pour les règles
(`match-rules.ts` recopié dans la coque, faute d'étape de compilation) : ici la
logique est trop grosse pour être dupliquée.

Le module ne touche ni au DOM ni au stockage en dehors de `saveJournal` /
`loadJournal` : tout le reste est une fonction pure qui reçoit l'état et rend
`{ state, accepted, reason }`.

## Machine d'états

```text
BLOC ──(un joueur à la frontière)──▶ ATTENTE ──(les deux + sauvegardes)──▶ PREPARE
  ▲                                                                          │
  └──(bloc suivant, compteurs remis à zéro)── RESULTAT ◀──(résultat réglé)── DUEL
                                                                    │
                                          dernier bloc ──▶ FINI ──(égalité)──▶ manche supplémentaire
```

- **Frontière** : `blockSize - 1` combats contre l'IA. Le joueur qui l'atteint
  s'arrête « entre deux combats », après récompense et sauvegarde, et attend
  l'autre. La sauvegarde suivante doit être **accusée** (`requiredSaveSeq`) avant
  que le duel ne s'ouvre : une session qui n'a pas fini d'écrire ne peut pas
  entrer en duel.
- **Manche supplémentaire** : un bloc sans combat contre l'IA (`needed == 0`),
  où les deux joueurs sont d'emblée à la frontière. La même machine suffit, sans
  branche spéciale dans le comptage.
- **Un seul chemin vers un point** : `recordDuelResult`, et uniquement après un
  duel ouvert par `recordDuelStarted` (lui-même refusé si les deux joueurs ne
  sont pas prêts). Un score envoyé par un cadre ne peut pas exister : le type de
  message ne le permet pas.
- **Rien n'est compté deux fois** : `battleId` mémorisés par joueur (64 derniers,
  un identifiant de combat est unique sur tout le match, pas seulement dans son
  bloc), identifiant de duel réglé mémorisé, et `saveSeq` strictement croissant.

## Journal et reprise

Écriture à deux temps, comme prévu : chaque fait accepté écrit
`local2p/v1/shell/match` (provisoire), puis les points durables — accusés de
sauvegarde, ouverture de duel, résultat, manche supplémentaire — valident la
version et la recopient dans `local2p/v1/shell/match.previous`.

À la relecture, une empreinte FNV-1a sur une sérialisation à clés triées tranche :
un journal tronqué ou modifié est refusé au profit de la copie validée, et si les
deux sont illisibles il n'y a **pas** de match à reprendre plutôt qu'un score
inventé. `resumeJournal` remet ensuite la phase d'aplomb sans jamais avancer un
compteur : un duel interrompu revient en `PREPARE` (le point n'est pas compté), un
bloc en cours reste en `ATTENTE` ou `BLOC`.

Un match terminé n'est pas reprenable : son score part dans
`local2p/v1/shell/history` (20 entrées) et le journal courant est effacé, pour que
l'accueil ne propose jamais de « reprendre » une partie finie. Quitter un match
en cours efface aussi son journal : abandonner n'est pas interrompre.

## Vérifications réellement exécutées

| Contrôle | Résultat |
| --- | --- |
| `pnpm exec vitest run test/tests/system/match-coordinator.test.ts` | 25 tests passés |
| `pnpm test` | 458 fichiers, 3 167 tests passés (6 ignorés, 111 à faire) |
| `pnpm typecheck` | OK (import d'un module JS depuis un test TypeScript compris) |
| `pnpm exec biome check` | Un seul avertissement, celui du `[hidden] !important` assumé depuis B2 |
| Navigateur : match complet joué par le seam | Bloc 1 : j1 à 3/3 → `ATTENTE`, un combat de plus refusé, j2 à 3/3, sauvegarde de j1 seule → toujours `ATTENTE`, puis `PREPARE` → duel → bloc 2 avec compteurs remis à zéro et 1 point pour j1 ; bloc 2 → `FINI` sur une égalité 1–1, tableau de bord « match égalité », historique écrit, journal effacé |
| Navigateur : égalité puis manche supplémentaire | `extraRound()` accepté, bloc 3, `PREPARE`, `needed == 0`, les deux joueurs à la frontière |
| Navigateur : reprise après arrêt | Match interrompu au bloc 2 (j1 1/3, j2 0/3, 1–0) ; **rechargement de la page** → bouton « Reprendre le match — bloc 2/3 · 0–1 » ; reprise → arène, cadres `?player=j1|j2`, tableau de bord restauré « J1 · bloc 2/3 · 1/3 combats · 0 pt » / « J2 · bloc 2/3 · 0/3 combats · 1 pt » |
| Navigateur : sortie | `quit()` → journal effacé, bouton de reprise masqué, repères remis à `J1`/`J2` |
| `pnpm exec vitest run test/tests/system/shell-protocol.test.ts` | 11 tests passés (v2, règles acceptées ou rejetées, factures de messages) |
| Navigateur : protocole v2 de bout en bout (onglet incognito, deux vraies scènes Phaser) | Après `frame/ready`, les deux cadres reçoivent `shell/rules` (`__shellEvents.rules()` renvoie bien les règles configurées : 2 blocs de 4) ; trois victoires annoncées **depuis le cadre** (la fonction qu'appelle `BattleEndPhase`) → « J1 · bloc 1/2 · 3/3 combats · 0 pt · frontière », puis j2 → `PREPARE` après les deux accusés de sauvegarde ; compteurs persistés dans le bon périmètre (`local2p/v1/j1/2pBattleSeq`, `j1|j2/2pSaveSeq`) |
| Navigateur : même combat annoncé deux fois | Le même objet de combat rend deux fois le **même** identifiant (`99-0-6`) et n'est compté qu'une fois : c'est ce qui protège d'une phase rejouée |
| Navigateur : boucle complète | Duel du bloc 1 donné à j2, puis victoire annoncée depuis un vrai cadre dans le bloc 2 → « J1 · bloc 2/2 · 1/3 combats · 0 pt » / « J2 · bloc 2/2 · 0/3 combats · 1 pt », avec les deux jeux qui tournent à l'écran |
| `pnpm exec vitest run test/tests/system/duel-park.test.ts` | 7 tests passés |
| Navigateur : frontière annoncée puis atteinte | Trois victoires annoncées depuis le cadre de J1 → bandeau « Bloc terminé · ton run s'arrête avant le prochain combat » dans sa moitié seulement, `armed` vrai dans le cadre, phase `ATTENTE`, J2 sans bandeau |
| Navigateur : arrêt effectif | Appel de la fonction qu'appelle la phase de rencontre (`__shellEvents.park`) → jeu arrêté, `frame/duel-waiting` reçu, bandeau remplacé par « Frontière atteinte · en attente de J2 », suite mémorisée **non** exécutée |
| Navigateur : la pause commune ne libère pas | Pause puis reprise partagées → le cadre parqué reste à l'arrêt (`waiting` vrai), c'est la propriété qui empêche de reprendre un bloc déjà clos pour lui |
| Navigateur : reprise d'un match avec un joueur à l'arrêt | Rechargement de page puis « Reprendre le match » → le cadre reçoit `shell/rules` **et** `shell/wait-for-duel` à son `frame/ready` : l'arrêt, qui ne survit pas à un rechargement, est réarmé tout seul |
| Navigateur : manche due et libération | Les deux joueurs à 3/3, sauvegardes accusées → `PREPARE`, bouton « Duel non joué · manche nulle » dans la barre, bandeau « Duel à jouer » dans les **deux** moitiés ; règlement → bloc 2, score 0–0, les deux cadres relâchés (`waiting` faux), suite de J1 exécutée, bandeaux et bouton effacés |
| Navigateur : préparation du duel (C2) | Les deux équipes figées arrivent de leurs cadres → plafond commun « 30 » écrit dans le journal, `shell/duel-prepare` reçu par les deux moitiés, bandeau « … · plafond 30 · prêts : J2 J1 » |

## Reste à faire

1. **Moteur de duel** (lot D) : c'est ce qui remplace la manche comptée nulle.
   Le chemin est prêt des deux côtés — `recordDuelStarted` ouvre la manche,
   `recordDuelResult(duelId, winner)` la règle et libère les deux joueurs — il ne
   manque que la simulation autoritaire et son interface.
2. **Duel à la demande** : le mode est décrit et configurable, mais il attend le
   même moteur ; le coordinateur n'a volontairement qu'un seul chemin vers un
   point, celui des duels de bloc.
3. ~~**Instantanés d'équipe** (C2)~~ : **livré** (voir
   [`C2-duel-snapshots.md`](./C2-duel-snapshots.md)). Le journal porte maintenant
   `duelTeams` et `duelCap`, `recordDuelTeam` reçoit l'équipe figée d'un joueur à
   sa frontière, et `duelPrepared` résume « les deux équipes sont là, joueurs
   prêts, même duel ». Le mode à blocs continue d'ouvrir sa manche nulle sans
   instantané : c'est le lot D qui n'ouvrira un duel réel que sur `duelPrepared`.

## Limites connues

- L'identifiant d'un combat est mémorisé sur l'objet du combat et numéroté dans
  le périmètre du joueur (`2pBattleSeq`). Une victoire annoncée juste avant un
  arrêt d'Android est donc perdue pour le compteur (fenêtre de quelques
  millisecondes) ; c'est le prix à payer pour ne jamais compter deux fois. Le
  reconcilier demanderait de persister le compteur de bloc dans la sauvegarde de
  session.
- L'arrêt ne survit pas au rechargement de la page d'un cadre : la coque le
  réarme à chaque `frame/ready` (`shell/wait-for-duel`), ce qui remet le joueur à
  l'arrêt au point sûr suivant. Entre les deux, le cadre peut avoir recommencé un
  combat — que le coordinateur refuse, donc sans conséquence sur le comptage, mais
  visible à l'écran.
- L'arrêt a lieu à la sauvegarde de la vague **suivante** : entre la victoire de
  frontière et le gel effectif, il y a l'écran de récompense puis le chargement de
  la vague, soit quelques secondes pendant lesquelles le bandeau dit seulement
  que le run va s'arrêter.
- Un run qui se termine (K.O. total) juste après la frontière n'a plus de vague
  suivante : le joueur n'est alors jamais mis à l'arrêt, et le bloc suivant
  repart de la nouvelle partie.
- Le bouton « Duel non joué · manche nulle » est **provisoire** : il existe pour
  que le mode à blocs soit jouable sans le moteur de duel. Il disparaîtra avec le
  lot D, et le score d'un match joué avec lui se lit comme un match sans vainqueur
  de manche.

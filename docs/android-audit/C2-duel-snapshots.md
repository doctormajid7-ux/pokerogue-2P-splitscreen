<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# C2 — Instantanés de duel et renforts de banque

Livrable de la mission C2 du plan, aux règles de
`docs/android-2p-game-modes.md` : à la frontière du bloc, chacun des deux runs est
**figé** en une copie d'équipe, la coque garde les deux copies, en déduit un
plafond commun, puis renvoie le duel figé aux deux cadres. Les sauvegardes PvE ne
sont jamais relues par le duel : un duel avorté, interrompu ou perdu ne peut rien
changer à une progression.

Ce qui reste est nommé en fin de page : le moteur de duel lui-même (lot D), le
choix des renforts à l'écran (E2) et l'alimentation de la banque (E1).

## Ce qui est livré

| Élément | Rôle |
| --- | --- |
| `src/system/duel-snapshot.ts` | Format d'instantané, validation, empreinte, plafond commun, renforts de banque, arguments de reconstruction |
| `test/tests/system/duel-snapshot.test.ts` | 41 tests : capture, refus des données corrompues, copie profonde, empreinte, plafond, renforts, banque |
| `src/system/shell-protocol.ts` | Protocole v2 étendu : `shell/duel-invite`, `shell/duel-prepare`, `frame/duel-team`, `frame/duel-ready`, validation du duel préparé |
| `src/system/shell-bridge.ts` | Côté cadre : capture de l'équipe de run, application du plafond et des renforts, empreinte annoncée |
| `android/shell/match-coordinator.js` | Journal : réception des deux instantanés, plafond, `duelPrepared`, nettoyage du bloc réglé |
| `android/shell/2p.js` | Demande des équipes à la frontière, contrôle du joueur émetteur, affichage du plafond, réarmement de la préparation au `frame/ready` |
| `test/tests/system/match-coordinator.test.ts` | 37 tests, dont 11 sur les instantanés : frontière, autre joueur, autre duel, plafond, reprise, nettoyage |
| `test/tests/system/shell-protocol.test.ts` | 18 tests, dont 6 sur les messages de duel |

## Décision : un instantané est un jeu d'ingrédients, pas un état de combat

Le format ne transporte **que** ce qui sert à reconstruire un Pokémon : espèce,
forme, niveau, capacité, talent passif, chromatique et variante, sexe, nature, IV,
attaques (PP compris), surnom, Tera, provenance de rencontre, et la fusion. Rien
d'autre n'est copié du run :

- **pas de PV, pas de statut, pas de paliers** : un duel commence donc toujours
  avec une équipe soignée, sans avoir à « réparer » quoi que ce soit ;
- **PP remis à plein à la capture** : un duel ne se décide pas avec les attaques
  déjà usées pendant le bloc ;
- **pas de statistiques calculées** : c'est ce qui donne son sens au plafond. Si
  l'instantané transportait les statistiques du run, ramener un niveau de 47 à 30
  ne changerait aucun chiffre ; ici la reconstruction passe par le chemin de
  niveau du jeu (`toBuildArguments` fournit ses entrées) et les statistiques sont
  recalculées depuis le niveau, les IV et la nature.

Le `PokemonData` réel est accepté **structurellement** par `captureMember` : le
compilateur refuse un champ qui divergerait, et aucune copie champ par champ ne
peut oublier une donnée que la reconstruction utilise.

## Décision : deux temps, parce que le plafond dépend des deux équipes

Le plafond est `min(meilleur niveau J1, meilleur niveau J2)` arrondi au multiple
de 5 inférieur. Il ne peut donc pas être annoncé avant que les deux équipes soient
connues. La préparation se fait en deux messages, et l'ordre porte tout le sens :

```text
frontière + sauvegardes accusées
        │
        ├─▶ shell/duel-invite  (duelId, renforts autorisés)   ── coque → cadres
        │        └─ le cadre copie son équipe de run, soignée
        ├─◀ frame/duel-team    (duelId, équipe, empreinte)    ── cadres → coque
        │        └─ la coque garde l'instantané dans le journal (écriture validée)
        │
   les deux équipes connues → plafond
        │
        ├─▶ shell/duel-prepare (duelId, plafond, renforts, les deux équipes)
        │        └─ chaque cadre plafonne et applique ses renforts
        └─◀ frame/duel-ready   (empreinte de l'équipe jouée)
```

`frame/duel-ready` n'est pas décoratif : c'est l'empreinte de l'équipe que le
cadre jouera réellement. Les deux cadres partent du même contenu figé, donc une
équipe plafonnée identique donne la même empreinte — vérifié en navigateur, deux
cadres distincts rendent bien `324e9c04`. La coque enregistre ces empreintes :
deux moitiés qui ne parlent pas du même duel se voient avant le premier tour, au
lieu de se découvrir au milieu d'un combat.

## Décision : l'identifiant de duel est dérivé du journal

`duelIdFor(state)` = `matchId:bloc:manches supplémentaires`. Un identifiant tiré
au hasard obligerait à le persister, et une reprise devrait le retrouver pour que
les instantanés déjà figés restent valides. Dérivé, il est **stable par
construction** : une reprise prépare le même duel, et il change tout seul quand le
bloc avance ou qu'une manche supplémentaire est accordée.

Conséquence, et c'est le point du contrôle : `recordDuelTeam` refuse un instantané
dont le `duelId` n'est pas celui du bloc courant. Un cadre qui répond en retard,
avec l'équipe du bloc précédent, est refusé — jamais « presque accepté ».

## Décision : renforts tout ou rien, et banque jamais consommée

`applyReinforcements` reçoit les remplacements choisis, la banque et le nombre
d'emplacements autorisé par la configuration. Une demande qui dépasse l'autorisation,
qui vise une entrée inconnue, un emplacement hors équipe, le même emplacement deux
fois ou la même entrée deux fois est **entièrement refusée** : le duel se joue alors
sans renfort plutôt qu'avec la moitié d'une demande appliquée. Une entrée
remplacée est **copiée** : la banque ne perd rien, perdre le duel ne retire rien.

La banque est lue dans le profil du joueur (`local2p/v1/<joueur>/profile/v1`), que
le lot E1 écrira. Tant qu'il est absent, la banque est vide et un renfort n'a rien
à prendre : le mécanisme est complet, il attend ses entrées.

## Ce qui garantit qu'aucune sauvegarde PvE n'est altérée

1. La capture **lit** l'équipe (`new PokemonData(pokemon)`) et n'écrit rien : ni
   la sauvegarde de session, ni le run en cours ne sont touchés.
2. Le duel se joue depuis les copies du journal ; le journal est une clé à part
   (`local2p/v1/shell/match`), écrite en deux temps (provisoire puis validée).
3. Le plafond et les renforts s'appliquent sur des copies successives
   (`applyLevelCap` puis `applyReinforcements`), jamais sur l'équipe du run.
4. Après le duel, le bloc avance et les instantanés du bloc réglé sont effacés :
   ils ne peuvent pas resservir au bloc suivant.
5. Un match terminé vide aussi ses instantanés avant d'être archivé.

## Vérifications réellement exécutées

| Contrôle | Résultat |
| --- | --- |
| `pnpm exec vitest run test/tests/system/duel-snapshot.test.ts` | 41 tests passés |
| `pnpm exec vitest run test/tests/system/match-coordinator.test.ts` | 37 tests passés (dont 11 sur les instantanés) |
| `pnpm exec vitest run test/tests/system/shell-protocol.test.ts` | 18 tests passés (dont 6 sur les messages de duel) |
| `pnpm exec vitest run` sur les cinq modules système | 122 tests passés (instantanés, coordinateur, protocole, attente, règles) |
| `pnpm typecheck` | OK, `PokemonData` accepté comme source d'instantané (compatibilité vérifiée par le compilateur) |
| `pnpm exec biome check --diagnostic-level=error` | Aucune erreur |
| Navigateur : le cadre refuse une équipe vide | `shell/duel-invite` reçu par les deux cadres, aucun `frame/duel-team` envoyé, avertissement « équipe de run illisible » dans les deux cadres (aucun run n'est chargé au démarrage du jeu) |
| Navigateur : la coque garde les deux instantanés | Deux `frame/duel-team` émis **depuis les cadres** (postMessage réel) → journal : J1 niveaux 47/49, J2 niveaux 30/32, chaque instantané avec son joueur, son duel et son empreinte |
| Navigateur : plafond commun | Équipes 47/49 et 30/32 → plafond **30**, écrit dans le journal, et les deux cadres reçoivent l'équipe plafonnée à 30/30 |
| Navigateur : accord des deux moitiés | Les deux cadres rendent la **même empreinte** `324e9c04` pour la même équipe plafonnée, et la coque enregistre exactement ces empreintes (issues des `frame/duel-ready`) |
| Navigateur : reprise à l'identique | Rechargement de la page puis « Reprendre le match — bloc 1/1 · 0–0 » → la coque renvoie `shell/duel-prepare` (instantanés du journal, aucun nouvel `shell/duel-invite`), les deux cadres recalculent **`324e9c04`**, le bandeau des deux moitiés affiche « plafond 30 » |
| Navigateur : bloc réglé | Manche comptée nulle (provisoire, lot D) → bloc avancé, `FINI`, instantanés effacés du journal, match archivé dans l'historique, les deux moitiés libérées de leur arrêt |
| Navigateur : sortie | `quit()` → journal effacé, accueil repris, aucun instantané ne survit |

## Reste à faire

1. **Moteur de duel** (lot D) : il consomme l'équipe préparée par
   `duelTeamForEngine()`. C'est lui qui remplace la manche comptée nulle, et lui
   qui renverra `shell/duel-result` (nom réservé, non implémenté).
2. **Choix des renforts** (E2) : le mécanisme est complet et testé
   (`__shellEvents.reinforce` en tient lieu pour l'instant), mais l'écran qui
   laisse un joueur désigner l'entrée de sa banque n'existe pas encore.
3. **Banque alimentée** (E1) : `bankEntryFrom` n'existe pas encore, c'est E1 qui
   écrira `ProfileV1` et sa banque bornée à 96 entrées.
4. **Objets tenus** : décision à prendre avec le moteur de duel (liste des objets
   autorisés), l'instantané ne les transporte pas aujourd'hui.

## Limites connues

- La capture exige un run chargé : sans équipe, le cadre refuse proprement (rien
  n'est envoyé, avec un avertissement) plutôt que de figer une équipe vide. C'est
  ce qu'on observe en navigateur, où les cadres restent à l'écran de connexion ;
  la boucle complète « équipe réelle → instantané → duel » demande un run joué.
- La banque est vide tant que le lot E1 n'écrit pas de profil : les renforts sont
  donc sans effet aujourd'hui, sans erreur ni message trompeur.
- L'équipe préparée vit en mémoire du cadre : elle ne survit pas à un rechargement
  de ce cadre, et c'est la coque qui la reconstruit à chaque `frame/ready`. Le
  contenu, lui, est dans le journal, donc la reconstruction est identique — c'est
  la propriété que le test de reprise vérifie.
- Un instantané est figé à la frontière : si un joueur modifie son équipe après
  coup (capture pendant les quelques secondes entre la victoire de frontière et
  l'arrêt effectif), le duel garde l'équipe du moment de la capture. C'est voulu —
  l'instantané est la garantie que le duel ne dépend plus du run — mais cela
  mérite d'être dit à l'écran quand le lot D branchera la préparation visible.
- Le plafond ne s'applique qu'au niveau : ni les objets, ni les talents, ni les
  valeurs de statistiques ne sont égalisés. C'est l'équilibrage prévu par les
  règles, à valider sur deux ou trois matchs réels.

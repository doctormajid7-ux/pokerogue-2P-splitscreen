<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# Modes de jeu à deux et profils joueurs

Ce document précise les règles de jeu du mode deux joueurs local décrit dans
`docs/android-2p-plan.md`. Le plan reste le document directeur du portage
(lots A→D, architecture, missions) ; ici on fixe **quoi** se joue : modes
disponibles, découpage d'une partie en blocs, profils persistants, banque de
captures et contrats de données.

Il remplace la règle provisoire du plan (« un duel toutes les cinq victoires PvE
par joueur »), qui devient un cas particulier de la configuration par blocs.

## Décisions prises

1. **Le duel clôt le bloc.** Un bloc vaut `N` combats *duel compris* : `N-1`
   combats contre l'IA puis le duel. Trois blocs de 10 → 27 combats contre l'IA
   + 3 duels = **30 combats**, l'exemple de référence.
2. **Le duel se dispute avec l'équipe du run, complétée par la banque du
   profil.** L'instantané d'équipe part de l'équipe du run en cours à la
   frontière du bloc (comme prévu au lot C) ; chaque joueur peut ensuite
   remplacer des emplacements par des Pokémon de sa banque. C'est ce qui permet
   de rester jouable quand un run a redémarré au milieu d'un bloc.
3. **Égalité déclarée, manche supplémentaire facultative.** À la fin du dernier
   bloc, le meilleur nombre de duels gagnés l'emporte ; à égalité le match se
   termine et l'écran de résultat propose « Un duel de plus » aux deux joueurs.
   Une manche supplémentaire est un bloc d'un seul combat, donc un seul duel.

## Vocabulaire

| Terme | Sens |
| --- | --- |
| **Run** | Une partie solo PokéRogue : vagues, dresseurs, captures, dresseurs d'arène, jusqu'au K.O. total ou à la fin. Chaque joueur a le sien |
| **Combat** | Un combat PvE d'un run, contre un Pokémon sauvage ou un dresseur |
| **Bloc** | Suite de combats PvE terminée par un duel : `N-1` combats + 1 duel |
| **Duel** | Un combat J1 contre J2, simulé une seule fois par le moteur autoritaire (lot D) |
| **Match** | La partie à deux joueurs complète : les blocs, les duels et le score |
| **Profil** | Identité persistante d'un joueur : nom, statistiques à vie, dex, banque. Survit aux runs et aux matchs |
| **Banque** | Les Pokémon capturés conservés par le profil, utilisables en renfort de duel |

## Modes

Choisi à l'accueil de la coque 2P, avant le lancement.

### 1. Duo libre (`side-by-side`)

Le mode livré avec le lot B : deux runs indépendantes côte à côte, aucun duel
programmé. Chacun joue à son rythme, met en pause quand il veut, et son profil
progresse normalement (captures, statistiques). Un duel à la demande reste
possible depuis la barre centrale, **hors score**.

C'est la réponse au besoin « lancer des parties solo chacun de son côté » dans
l'application à deux.

### 2. Match à blocs (`blocks`)

Le mode principal. J1 configure le match, les deux joueurs confirment, puis :

```text
bloc 1 : N-1 combats PvE → frontière → duel → point
bloc 2 : N-1 combats PvE → frontière → duel → point
…
bloc K : N-1 combats PvE → frontière → duel → point
fin     : score des duels → gagnant, ou égalité + manche supplémentaire
```

- Les combats d'un bloc sont **indépendants** : chaque joueur avance à son
  rythme, sans se synchroniser combat par combat. Le premier arrivé à la
  frontière attend (« En attente de J2 — 7/9 combats »), et la barre centrale
  affiche la progression de chacun.
- À la frontière, les deux runs sont sauvegardées, les instantanés d'équipe
  sont pris, et le duel commence. Le classique « une défaite PvP n'efface pas la
  progression PvE » s'applique : le duel ne modifie aucun PV, objet, statut ni
  récompense des runs.
- **Un duel gagné = un point.** Le match est gagné par le plus grand nombre de
  points. Les combats PvE ne comptent pas au score ; ils font la force de
  l'équipe.
- La configuration est **figée pendant le match** : elle ne change qu'entre
  deux matchs, sinon les scores de blocs ne seraient plus comparables. La
  dernière configuration utilisée est proposée par défaut au match suivant.

### 3. Duel à la demande

Disponible dans les deux modes, depuis la barre centrale. Un duel immédiat,
sans effet sur le score ni sur les compteurs de blocs. Il sert à tester, à
trancher une revanche, et à valider le moteur PvP (lot D) avant que le
coordinateur n'existe. Ses instantanés sont jetés après le duel.

## Configuration (J1 décide)

Le panneau est dans la **moitié basse**, tenue par J1 et lisible dans le bon
sens ; le récapitulatif est répété dans la moitié haute, retourné, pour que J2
lise la même chose. Aucun des deux ne peut lancer le match sans appuyer sur
« Prêt » dans sa propre moitié.

| Champ | Plage | Défaut | Effet |
| --- | --- | --- | --- |
| Mode | Duo libre / Match à blocs | Duo libre | — |
| Combats par bloc (`N`) | 2 à 99 | 10 | Inclut le duel final |
| Nombre de blocs (`K`) | 1 à 20 | 3 | Donc `K` duels |
| Renforts de banque | 0 à 3 | 1 | Emplacements remplaçables à la préparation du duel |
| Plafond de duel | Aucun / automatique | Automatique | Voir « Équilibrage » |

Le panneau affiche en permanence l'arithmétique dérivée, pour qu'il n'y ait
aucune ambiguïté sur ce qu'on vient de choisir :

> 3 blocs de 10 combats → 27 combats contre l'IA + 3 duels = **30 combats**

Contraintes de saisie : `N ≥ 2` (un bloc doit contenir au moins un combat contre
l'IA, sinon ce n'est plus un bloc mais une suite de duels), `K ≥ 1`. Le modèle
et ses bornes vivent dans `src/system/match-rules.ts`, la coque en recopie la
table et les deux se vérifient : une valeur hors bornes est **ramenée dans ses
bornes**, un champ illisible ou un enum inconnu retombe sur sa valeur par
défaut, et rien n'est accepté sans passer par là — ni à l'écriture, ni à la
lecture côté cadre.

## Profils

Le profil est l'identité persistante d'un joueur, indépendante du run et de sa
moitié d'écran. J1 et J2 chargent chacun un profil distinct à l'accueil.

```text
local2p/v1/shell/profiles/v1       ← liste des profils et sélection J1/J2
local2p/v1/profiles/<id>/profile/v1 ← identité, statistiques, dex, banque
local2p/v1/profiles/<id>/…          ← sauvegardes et réglages du profil
local2p/v1/j1/… et /j2/…            ← anciennes données conservées après copie
local2p/v1/shell/rules     ← configuration choisie par J1
local2p/v1/shell/match     ← journal du match en cours
local2p/v1/shell/history   ← matchs terminés (borné, 20 entrées)
```

### Ce que le profil contient

```ts
interface ProfileV1 {
  version: 1;
  profileId: string; // identifiant opaque, stable à vie
  displayName: string; // 1 à 16 caractères, modifiable par le joueur
  avatar?: string; // icône choisie à l'accueil
  color?: string; // couleur choisie à l'accueil
  createdAt: number;
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    duelsWon: number;
    duelsLost: number;
    duelsDrawn: number;
    pveBattlesWon: number;
    bestRunWave: number;
  };
  /** Résumé par espèce : vu, capturé, première capture. */
  dex: Record<number, { seen: boolean; caught: number; firstCaughtAt: number }>;
  /** Les captures réellement conservées, utilisables en renfort de duel. */
  bank: BankEntry[];
}

interface BankEntry {
  entryId: string;
  speciesId: number;
  formKey?: string;
  variant?: string; // shiny, forme rare, etc.
  level: number; // niveau au moment de la capture
  ability: string;
  nature: string;
  moves: string[];
  caughtAt: number;
  matchId: string;
  runId: string;
  wave: number;
}
```

### Alimentation

- **Capture** : après une capture confirmée dans un run (sauvage ou dresseur),
  une entrée est ajoutée à la banque et le résumé du dex est mis à jour. Un
  échec de capture ne touche pas la banque.
- **Fin de combat** : `pveBattlesWon`, `bestRunWave` et le compteur du bloc
  courant sont incrémentés au même endroit, après écriture de la sauvegarde du
  run, pour qu'un redémarrage ne compte jamais deux fois (déduplication par
  `matchId + playerId + battleId`, lot C1).
- **Fin de duel** : `duelsWon` / `duelsLost` / `duelsDrawn` du profil sont
  crédités une seule fois, par le résultat autoritaire du moteur de duel.
- Le match lui-même n'écrit jamais dans le profil en dehors de ces points : le
  score du match vit dans le journal du match, pas dans le profil.

### Banque : une banque, pas un musée

La banque n'a plus de plafond d'entrées fixe. Les Pokémon sont triés pour
présenter d'abord le meilleur exemplaire de chaque espèce et variante ; toutes
les captures restent toutefois conservées. Le Pokédex garde séparément la trace
des espèces vues et capturées. La limite pratique est celle du stockage local
de l'application. Trois contraintes restent à surveiller :

1. `localStorage` est aussi l'endroit où vivent les sauvegardes des deux runs ;
2. l'instantané de duel doit rester petit et haché vite à chaque frontière ;
3. une banque très grande alourdit la liste des renforts envoyée au début d'un
   duel ; le profil n'est pas tronqué pour autant.

Le mode solo historique (l'icône « PokéRogue ») reste inchangé : ses clés
`localStorage` gardent leur nom, il n'a ni profil ni banque. Le profil est une
notion du mode deux joueurs.

### Écran de profil

Accessible depuis l'accueil 2P. Par moitié, dans
l'orientation de son propriétaire :

- sélection, création, nom, icône et couleur du profil ;
- duels gagnés / perdus / nuls, matchs gagnés, combats PvE gagnés, meilleure vague ;
- dex : nombre d'espèces vues et capturées ;
- banque : nb d'entrées, meilleures entrées par espèce.

Aucun réseau, aucun compte distant : les profils sont strictement locaux.

## Duels

### Équipe de duel

1. À la frontière du bloc, chaque joueur prend un **instantané de l'équipe de
   son run** (jusqu'à 6 Pokémon), tel que prévu au lot C2 : copie, jamais une
   référence mutable vers le run.
2. À la préparation du duel, chaque joueur peut remplacer jusqu'à
   `bankRenforts` emplacements par des entrées de sa banque. Un remplacement
   est une copie aussi : la banque n'est pas consommée, perdre un duel ne
   retire rien.
3. Les niveaux sont ensuite ramenés à un plafond commun, puis les statistiques
   recalculées par le chemin de changement de niveau existant de PokeRogue
   (attaques, évolutions, objets et nature conservés).

Ce que contient réellement un instantané (lot C2, `src/system/duel-snapshot.ts`) :
uniquement les **entrées de construction** d'un Pokémon — espèce, forme, niveau,
capacité, talent passif, chromatique et variante, sexe, nature, IV, attaques et
PP, surnom, Tera, provenance de rencontre, et la moitié fusionnée le cas échéant.
Ni PV, ni statut, ni paliers de statistiques, ni statistiques calculées : le duel
part donc d'une équipe **soignée**, ses PP sont remis à plein, et le plafond
change réellement les chiffres puisque les statistiques sont recalculées à la
construction. Les objets tenus ne font pas partie de l'instantané pour l'instant
(le duel se joue sans objet, ce que les règles autorisent) ; les y ajouter est une
décision à prendre avec le moteur du lot D, en même temps que la liste des objets
autorisés.

### Équilibrage

Plafond automatique (défaut) : `plafond = min(meilleur niveau de l'équipe J1,
meilleur niveau de l'équipe J2)`, arrondi au multiple de 5 inférieur. Personne
ne se retrouve avec un rouleau compresseur après avoir enchaîné les combats du
bloc ; le joueur resté plus faible garde une chance, et l'écart de progression
reste un avantage sans être décisif.

Plafond « aucun » : les niveaux réels s'affrontent, pour deux joueurs qui
veulent mesurer leur progression brute. À réserver aux duels à la demande.

Alternative étudiée et écartée pour l'instant : un plafond fixe choisi par J1
dans la configuration (25/50/75/100). Plus lisible, mais il rend invisible la
force réelle des équipes au moment où il est choisi, et il fige la méta.

### Règles du duel

Identiques au plan, lot D :

- une seule simulation fait autorité (PV, statuts, vitesse, RNG, dégâts) ;
- J1 et J2 choisissent dans leur moitié, les choix sont masqués jusqu'au
  verrouillage des deux ;
- ni capture, ni fuite, ni objets consommables pendant le duel ;
- premier jalon : un Pokémon par joueur, `FIGHT` seul, quatre attaques ; ensuite
  équipes complètes, changements, remplacement après K.O. ;
- une interruption Android relance le duel depuis son instantané stable.

Un duel est **gagné, perdu ou nul** (K.O. simultané, limite de tours si on en
introduit une). Les deux camps peuvent capturer et faire progresser leur profil
autour du duel, dans leurs runs ; pas pendant le duel.

## Machine d'états du match

```text
SETUP      J1 configure, les deux appuient sur « Prêt »
BLOC       chacun enchaîne ses combats PvE indépendamment
ATTENTE    le premier arrivé à la frontière attend l'autre
PREPARE    sauvegarde des deux runs, instantanés, renforts de banque, plafond
DUEL       moteur autoritaire, choix masqués
RESULTAT   point crédité, journal écrit, retour en BLOC (bloc suivant)
FINI       score, gagnant ou égalité, manche supplémentaire facultative
```

Le journal versionné (`MatchStateV1`) contient `matchId`, les règles figées,
le numéro de bloc, la phase, et par joueur : `pveInBlock`, `pveTotal`,
`duelsWon`, `ready`, `lastSavedSeq`. Écriture atomique, reprise au redémarrage
comme prévu au lot C1/C2 : en `ATTENTE` on reprend l'attente, en `PREPARE` ou
`DUEL` on reconstruit depuis l'instantané, en `RESULTAT` on réaffiche sans
recompter le point.

## Contrat d'échange

Le protocole de la coque passe en **version 2** (les deux côtés sont livrés dans
le même APK, un changement de version est donc sûr). Le lot B fournit
`shell/hello`, `shell/pause`, `shell/resume`, `shell/release-inputs` et les
réponses `frame/ready`, `frame/paused`, `frame/resumed`. Le lot C1 ajoute, en
respectant le style de ces noms :

```ts
// Livré : la coque donne les règles, le cadre annonce ce qu'il a joué.
type Match2PMessageV2 =
  | { type: "shell/rules"; rules: MatchRulesV1; schedule: MatchSchedule }
  | { type: "frame/pve-battle-won"; battleId: string }
  | { type: "frame/pve-saved"; saveSeq: number };
```

Le cadre **ne dit jamais qui il est** : la coque déduit le joueur de la source du
message (`event.source`, comparée à la fenêtre de chaque moitié), et c'est la
seule identité qui compte. Un cadre ne peut donc pas marquer un point à la place
de l'autre, ni annoncer une victoire qui n'est pas la sienne.

Le lot C2 ajoute la préparation du duel, en deux temps — la coque ne peut pas
connaître le plafond avant de connaître les deux équipes :

```ts
// Livré : la coque demande les équipes, garde les deux, annonce le duel figé.
type Match2PMessageV2Duel =
  | { type: "shell/duel-invite"; duelId: string; bankRenforts: number }
  | { type: "frame/duel-team"; duelTeam: DuelTeamPayloadV1 }
  | { type: "shell/duel-prepare"; duelId: string; cap: number | null; bankRenforts: number; teams: { j1, j2 } }
  | { type: "frame/duel-ready"; checksum: string };
```

L'identifiant du duel n'est pas tiré au hasard : il est dérivé du journal
(`matchId:bloc:manches supplémentaires`), donc une reprise prépare exactement le
même duel, et un instantané figé pour un autre bloc est refusé plutôt que rejoué.

Restent pour les lots suivants, dans le même style :

```ts
type Match2PMessageV2Suite =
  | { type: "shell/duel-result"; duelId: string; winner: PlayerId | "draw"; stateHash: string }
  | { type: "frame/profile-updated"; profileHash: string };
```

Comme au lot B : enveloppe `protocolVersion`, `matchId`, validation de l'origine
et de la source, schéma vérifié à l'entrée — y compris le motif de règles, rejeté
s'il n'est pas jouable plutôt qu'appliqué à moitié. Aucun message ne transporte
d'instance Phaser, de classe `Pokemon`, de profil complet ni de score :
uniquement des faits constatés par la session qui les vit.

## Missions à ajouter au plan

| Mission | Livrable | Condition de passage |
| --- | --- | --- |
| B3. Accueil et tableau de bord 2P | Sélecteur de mode, configuration J1, récapitulatif lisible par les deux, barre centrale avec progression de bloc et score | On configure un match de 3 blocs de 10 et les deux joueurs voient 27+3=30 avant de lancer |
| C1. Coordinateur de match ✅ | Machine d'états, journal versionné, compteur de bloc, frontière et attente | Un duel se déclenche une seule fois à la fin de chaque bloc, même après un arrêt forcé |
| C2. Instantanés et renforts ✅ | Sérialisation d'équipe, plafond commun, emplacements de banque, reprise après plantage | Aucune sauvegarde PvE altérée, duel reconstruit à l'identique |
| E1. Profil persistant | `ProfileV1`, banque alimentée par les captures, écran de profil, statistiques | Deux profils survivent à un arrêt forcé et à plusieurs matchs ; dex et banque à jour |
| E2. Duel de banque | Équipe choisie librement dans la banque, plafond appliqué | Un duel se joue avec des Pokémon capturés lors de matchs précédents |

Le lot D (moteur PvP) ne change pas : il consomme un `DuelTeamSnapshot`, d'où il
vient lui est indifférent.

## Risques et points ouverts

1. **Mémoire** : deux runs Phaser + l'UI de duel restent le premier risque
   technique du projet (déjà identifié au lot B2). Un match de 30 combats dure
   une à deux heures : la reprise après un arrêt du processus doit être sans
   perte, y compris au milieu d'un duel.
2. **Banque volumineuse** : sans plafond d'entrées arbitraire, surveiller le
   quota local et le temps d'ouverture de la liste de renforts ; ajouter une
   recherche ou une pagination si les essais réels montrent un ralentissement.
3. **Plafond de duel** : `min` des meilleurs niveaux peut sembler punitif à
   celui qui a le plus progressé. À mesurer sur deux ou trois matchs réels.
4. **Duel à la demande pendant un bloc** : autorisé et hors score par défaut,
   mais il peut casser le rythme. Interrupteur à prévoir dans la configuration.
5. **Politique de son en 2P** : deux pistes musicales jouent encore ensemble
   (question laissée ouverte au lot B2), à trancher avant C1.
6. **Rôles** : un profil peut être chargé dans l'autre moitié à l'accueil ; le
   même profil ne peut pas être utilisé simultanément par J1 et J2.

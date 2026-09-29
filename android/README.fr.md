<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# PokéRogue sur Android

Ce guide s'adresse aux joueurs. L'application Android contient PokéRogue et peut fonctionner sans connexion Internet. Elle propose une entrée pour jouer seul et une autre pour jouer à deux sur le même téléphone. Les sauvegardes et les profils restent sur le téléphone.

Read this guide in [English](./README.md). Pour les changements de cette version Android, consultez le [changelog](./CHANGELOG.md).

## Installer l'application

Android 7.0 ou une version plus récente est nécessaire, ainsi que Android System WebView et l'accélération graphique. Si l'application signale qu'une fonction nécessaire manque, mettez à jour **Android System WebView** depuis le Play Store, puis relancez le jeu.

Si vous avez reçu un fichier `.apk` :

1. Copiez-le sur le téléphone ou téléchargez-le avec celui-ci.
2. Ouvrez-le depuis **Fichiers** ou **Téléchargements**.
3. Si Android le demande, autorisez temporairement cette application à installer des applications, puis revenez à l'installation.
4. Appuyez sur **Installer**, puis ouvrez **PokéRogue** ou **PokéRogue 2Players**.

Les deux entrées sont comprises dans une même installation. **PokéRogue** ouvre le jeu solo et **PokéRogue 2Players** le mode à deux. Le fichier APK distribué par ce projet s'appelle `PokeRogue-Android-2Players.apk`.

## Jouer en solo

Ouvrez **PokéRogue**. Vous pouvez continuer la sauvegarde solo habituelle ou choisir un profil créé en mode deux joueurs. Un profil utilise la même progression de jeu dans les deux modes : vous pouvez avancer seul puis continuer cette progression à deux. L'ancienne sauvegarde solo reste séparée.

Le cadrage s'adapte quand vous tournez le téléphone. En portrait, le jeu s'ajuste à la largeur de l'écran ; en paysage, il utilise la largeur disponible. Pincez avec deux doigts pour régler le zoom. Le zoom revient à son réglage normal après un changement d'orientation.

Les commandes tactiles se règlent dans les paramètres du jeu. Vous pouvez les déplacer pour dégager les parties importantes de l'image. Les positions en portrait et en paysage sont mémorisées séparément.

## Jouer à deux sur un téléphone

Ouvrez **PokéRogue 2Players** et tenez le téléphone en **portrait**, entre les deux joueurs. J1 joue dans la moitié du bas. J2 joue dans la moitié du haut, retournée à 180° pour que la personne en face lise l'écran à l'endroit. L'écran de configuration reprend la police pixel, les cadres et les menus du jeu. Chacun a son profil, ses sauvegardes, ses réglages, ses commandes tactiles et sa progression. La barre du milieu contient les boutons de pause et de sortie communs.

Chacun touche uniquement sa moitié. Les combats utilisent la scène habituelle du jeu : arène, sprites, animations, barres de vie et messages. Pendant un duel entre joueurs, chacun choisit une action et les attaques se jouent l'une après l'autre.

Les menus de configuration et de profil du mode 2 joueurs suivent par défaut la langue du dernier profil ouvert en solo. Si ce profil n'a pas encore enregistré de langue, ils utilisent celle du téléphone. Le menu de préparation permet de choisir une autre langue. Dans chaque écran de jeu, la langue vient du profil sélectionné : les deux joueurs peuvent donc jouer dans des langues différentes.

### Les modes de jeu

- **Duo libre** : chacun joue sa propre partie contre l'IA et avance à son rythme. Activez **Permettre un duel en Duo libre (avec point)** pour afficher le bouton Duel commun. Le duel commence quand les deux parties arrivent à un moment sûr ; son vainqueur reçoit un point dans son profil.
- **Match à blocs** : chacun progresse contre l'IA dans sa partie. À la fin de chaque bloc, les deux joueurs se retrouvent pour un duel. Si un joueur termine en premier, il attend l'autre. J1 choisit le nombre de combats par bloc et le nombre de blocs.
- **Combat rapide aléatoire** : le duel commence immédiatement avec deux équipes de six Pokémon préparées par l'ordinateur. **Pokémon totalement aléatoires, niveaux équilibrés** tire des Pokémon différents pour chaque équipe et leur donne un même niveau choisi au hasard entre 1 et 100. **Équipes équilibrées, choisies par l'ordinateur** essaie d'opposer des Pokémon de force de base comparable. Avec cette option, vous pouvez choisir leur niveau commun ou le laisser au hasard. Ce mode ne lance aucun combat contre l'IA et ne modifie pas la progression solo.

Dans **Combats dans un bloc**, le nombre comprend le duel. Avec 10 combats au total, chacun gagne 9 combats contre l'IA avant d'affronter l'autre joueur en duel. Avec 3 blocs de 10, chacun gagne 27 combats contre l'IA et vous jouez 3 duels ensemble. Chaque duel gagné rapporte 1 point ; les victoires contre l'IA font avancer la partie, mais ne changent pas le score entre joueurs. **Nombre de blocs** indique aussi le nombre de duels prévus.

Au démarrage, J1 règle la partie et J2 confirme avec **Prêt**. Les deux doivent confirmer avant le lancement. Si Android ferme l'application pendant un match, l'écran d'accueil propose de le reprendre.

Après un duel avec score, l'écran de résultat affiche le nom du profil du dresseur gagnant, les deux équipes et les objets qu'elles portaient au début du duel. En Duo libre, choisissez **Reprendre les parties** pour retourner aux deux parties contre l'IA ; à la fin d'un Match à blocs ou d'un Combat rapide aléatoire, choisissez **Retour à l'accueil**. Les objets ne sont pas encore utilisables en duel à deux : l'écran indique ceux que les Pokémon portaient et précise que leurs effets sont inactifs.

## Profils et progression

Chaque moitié de l'écran d'accueil possède son bouton de profil. Vous pouvez charger un profil, changer son nom, son icône ou sa couleur, ou en créer un. Un même profil ne peut pas être chargé par les deux joueurs en même temps.

Chaque profil conserve ses sauvegardes, ses réglages, sa progression et ses statistiques. Les données restent dans l'application sur ce téléphone ; elles ne sont pas envoyées vers un compte en ligne. La sauvegarde Android est désactivée. Effacer les données de l'application ou la désinstaller peut supprimer les sauvegardes.

Pour supprimer un profil, ouvrez son menu puis choisissez **Supprimer ce profil**. Deux confirmations sont demandées, car ses sauvegardes, réglages, captures et statistiques seront effacés. Si l'autre joueur utilise ce profil, chargez d'abord un autre profil pour lui.

Pour jouer seul avec la progression d'un profil, ouvrez **PokéRogue** et choisissez ce profil sur l'écran de sélection. Pour continuer cette progression à deux, chargez le même profil dans la moitié J1 ou J2. L'ancienne sauvegarde solo reste un choix séparé.

## Réserve de captures et réglages de duel

Les captures d'une partie à deux sont ajoutées à la réserve du profil correspondant. Elles peuvent remplacer des membres d'équipe lors de la préparation d'un duel. La réserve n'a pas de limite fixe de 96 Pokémon. En pratique, elle dépend du quota de stockage local disponible pour l'application et le navigateur. Le Pokédex solo garde la liste des espèces rencontrées ou capturées. La réserve 2 joueurs conserve aussi chaque Pokémon capturé afin de pouvoir le sélectionner pour un duel.

Dans les réglages du **Match à blocs** :

- **Pokémon capturés en renfort** permet de remplacer jusqu'à 0, 1, 2 ou 3 membres de l'équipe par des Pokémon de la réserve avant un duel. Le Pokémon choisi est copié dans l'équipe de duel et reste dans la réserve après le combat, quel qu'en soit le résultat.
- **Niveaux des Pokémon** propose l'**équilibrage automatique** ou **Garder les niveaux actuels**. L'équilibrage automatique fixe un plafond commun selon l'équipe la moins avancée, arrondi par tranche de 5. Par exemple, si les meilleurs Pokémon sont de niveau 41 et 32, le plafond est 30. Ce réglage ne change que le duel ; les niveaux sauvegardés restent inchangés.

La réserve appartient à un profil : les captures de J1 et J2 restent séparées. Le plafond concerne le niveau des Pokémon, pas le nombre de duels. En Match à blocs, le nombre de duels dépend du nombre de blocs.

## Son et connexion Internet

Le jeu et ses ressources sont compris dans l'application ; vous pouvez donc jouer hors ligne. La progression reste sur le téléphone et n'est pas automatiquement synchronisée avec le site, un autre téléphone ou un compte en ligne. Les musiques sont encodées à 32 kbit/s ou moins pour réduire la taille du téléchargement ; les effets sonores des combats restent disponibles. En mode deux joueurs, une seule musique joue à la fois, tandis que les effets sonores des deux combats restent actifs.

Pour compiler l'application, consultez les [notes de développement Android](./DEVELOPMENT.md).

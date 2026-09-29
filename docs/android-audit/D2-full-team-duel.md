<!--
SPDX-FileCopyrightText: 2026 Pagefault Games

SPDX-License-Identifier: CC-BY-NC-SA-4.0
-->

# D2 — Équipe complète dans le duel local

## État livré

- Chaque cadre reconstruit tous les membres de son équipe figée, au niveau plafonné et avec les renforts choisis. Un membre impossible à reconstruire refuse la préparation du duel entier.
- Les objets `PlayerPokemon` utilisés pour lire les statistiques sont détruits aussitôt après la sérialisation ; ils ne deviennent pas des membres de l'équipe PvE.
- La coque transporte les équipes complètes vers les deux cadres. La session garde les attaques de chaque camp privées jusqu'au verrouillage des deux choix.
- Le moteur garde un membre actif et une réserve par camp. Après un K.O., le premier membre valide de la réserve entre automatiquement. La défaite n'arrive que lorsque le camp n'a plus de membre valide.
- Les PV, PP, espèces et l'ordre de la réserve font partie de l'empreinte de chaque tour. Les deux cadres doivent rendre la même empreinte avant que la coque accepte le tour.
- L'efficacité des types est recalculée sur les types du défenseur actif à chaque attaque. Le tableau des types vient du jeu, ce qui couvre aussi les remplaçants.
- La vue du duel affiche le nombre de membres encore aptes au combat.
- Le joueur peut changer de Pokémon pendant un tour. Si toutes les attaques de son Pokémon actif ont zéro PP, **Lutte** est proposée : puissance 50 sans type, elle retire un quart des PV maximum à l'utilisateur après avoir touché.
- En cas d'interruption technique, la coque conserve l'instantané et propose de rejouer la manche. Aucun point n'est attribué à un duel interrompu.
- Le mode solo de l'APK réserve une zone distincte aux commandes tactiles en portrait et des marges latérales en paysage.
- Chaque moitié dispose d'un profil local et d'une banque de captures. Les renforts se choisissent avant le duel, sont copiés depuis la banque et subissent le même plafond de niveau que l'équipe du run.
- En duo libre, le bouton central peut demander un duel hors score. Les deux runs s'arrêtent chacun à leur prochaine frontière sûre, le duel utilise des copies d'équipe, puis les deux runs reprennent. Ce duel peut aussi être repris après une fermeture de l'application.

## Limites du moteur provisoire

Le tour utilise encore `src/system/duel-mechanics.ts`, une mécanique réduite. Les capacités, statuts, objets, talents, météo, terrains et attaques à effets spéciaux ne passent pas encore par le moteur de combat PokéRogue. Le remplacement volontaire et Lutte sont jouables dans ce moteur réduit. Il faut raccorder les effets complets avant de qualifier le duel de fidèle aux combats PvE.

## Suite de travail recommandée

1. Remplacer la mécanique réduite par la logique de combat PokéRogue. Garder l'instantané d'équipe séparé des deux runs PvE et conserver une graine de hasard commune. Vérifier chaque état de tour et son empreinte des deux côtés.
2. Faire un parcours sur appareil : deux runs PvE, frontière de bloc, duel avec plusieurs K.O., Lutte, changement volontaire, résultat comptabilisé une seule fois, retour aux deux runs et reprise après fermeture forcée. Vérifier aussi la place réservée aux commandes solo en portrait et paysage.
3. Mesurer mémoire et fréquence d'image avec deux scènes Phaser simultanées sur le téléphone cible. Aucun appareil n'est disponible dans cet environnement pour cette validation.

Ne pas marquer D2 comme un combat Pokémon complet sur la seule base du remplacement automatique.

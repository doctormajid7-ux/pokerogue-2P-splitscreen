/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Language preference written by the Android solo profile picker. */
const SOLO_LANGUAGE_SCOPE_KEY = "local2p/v1/shell/solo-language-scope/v1";
const SHELL_LANGUAGE_KEY = "local2p/v1/shell/language/v1";
const PROFILE_REGISTRY_KEY = "local2p/v1/shell/profiles/v1";
const PROFILE_ROOT = "local2p/v1/profiles/";

/** Keep these message values in the same order as MESSAGE_KEYS below. */
const MESSAGE_KEYS = [
  "appTitle",
  "player2Heading",
  "profileButton",
  "chooseProfile",
  "selectedProfile",
  "selectedProfileAria",
  "name",
  "icon",
  "gamepad",
  "star",
  "fire",
  "plant",
  "water",
  "lightning",
  "color",
  "purple",
  "red",
  "blue",
  "green",
  "yellow",
  "save",
  "createProfile",
  "profileNote",
  "deleteProfile",
  "confirmDelete",
  "cancel",
  "ready",
  "waitingSettings",
  "playersTitle",
  "player1Heading",
  "mode",
  "freeDuo",
  "blockMatch",
  "quickBattle",
  "battlesInBlock",
  "blockOption",
  "blockHelp",
  "blockCount",
  "blockCountHelp",
  "reinforcement",
  "none",
  "reinforcementHelp",
  "levels",
  "automaticBalance",
  "keepLevels",
  "levelHelp",
  "freeDuelPoint",
  "duelTeams",
  "randomTeams",
  "balancedTeams",
  "randomTeamsHelp",
  "balancedTeamsHelp",
  "level",
  "randomLevel",
  "chooseLevel",
  "randomLevelHelp",
  "chosenLevel",
  "resumeMatch",
  "readyLaunch",
  "progressHelp",
  "rotateHint",
  "profileStats",
  "captureBank",
  "noCaptures",
  "bankHelp",
  "selectedPrefix",
  "profileBlocked",
  "profileSaved",
  "enterName",
  "profileCreated",
  "profileUsed",
  "deleteAskFirst",
  "deleteAskSecond",
  "deleteButtonFirst",
  "deleteButtonSecond",
  "profileChanged",
  "deleteFailed",
  "profileDeleted",
  "profileCancelled",
  "profileLoaded",
  "modeHelpBlocks",
  "modeHelpFree",
  "modeHelpQuick",
  "recapQuickBalanced",
  "recapQuickRandom",
  "recapLevelRandom",
  "recapLevelFixed",
  "recapQuick",
  "recapFree",
  "recapFreeNoDuel",
  "recapBlocks",
  "longMatch",
  "quickHelpRandom",
  "quickHelpBalanced",
  "readyWaitingJ2",
  "readyWaitingJ1",
  "readyHint",
  "waitingHint",
];

const LOCALE_VALUES = {
  en: [
    "PokéRogue 2Players",
    "PLAYER 2",
    "Profile P{{player}}",
    "Choose a profile",
    "Selected profile: {{label}}",
    "Selected profile",
    "Name",
    "Icon",
    "Gamepad",
    "Star",
    "Fire",
    "Grass",
    "Water",
    "Lightning",
    "Color",
    "Purple",
    "Red",
    "Blue",
    "Green",
    "Yellow",
    "Save",
    "Create a profile with this name",
    "Each profile keeps its runs, captures and settings. Deleting it erases that data after two confirmations.",
    "Delete this profile",
    "Confirm deletion",
    "Cancel",
    "Ready",
    "Waiting for P1's settings.",
    "2 PLAYERS",
    "PLAYER 1 · SETUP",
    "Game mode",
    "Free Duo",
    "Block Match",
    "Random Quick Battle",
    "Battles in each block",
    "{{total}} ({{ai}} AI + duel)",
    "With 10 battles total, each player wins 9 battles against the AI before dueling the other player.",
    "Number of blocks",
    "Each completed block starts a duel between you. Each duel win is worth 1 point; AI battles do not score points.",
    "Captured Pokémon as reinforcements",
    "None",
    "Before a duel, each player can replace up to the selected number of Pokémon with captures from their profile. Captures remain saved.",
    "Pokémon levels",
    "Automatic balancing",
    "Keep current levels",
    "Automatic mode matches the less advanced player's level, rounded down to a multiple of 5. Saved levels are unchanged.",
    "Allow a scored duel in Free Duo",
    "Duel teams",
    "Completely random Pokémon, balanced levels",
    "Balanced teams, picked by the computer",
    "Each player gets six different Pokémon. Both teams have the same level.",
    "The computer creates two teams of six with similar base strength, then matches their levels.",
    "Level",
    "Random level, same for all",
    "Choose level",
    "In random mode, all 12 Pokémon share a level chosen at random from 1 to 100.",
    "Chosen level (1 to 100)",
    "Resume match",
    "Ready · start",
    "Separate progress: each player has separate saves, settings, profiles and touch controls. The in-game pause is shared.",
    "Hold the phone in portrait to play two-player.",
    "AI wins: {{pveBattlesWon}} · best wave: {{bestRunWave}} · duels W/L/D: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · matches: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} seen, {{caught}} caught",
    "Capture bank: {{count}} Pokémon",
    "No captures",
    "These copies can replace team members for a duel, according to the match rules.",
    "Selected profile: ",
    "Finish or resume the current match before changing profiles.",
    "Profile saved.",
    "Enter a name for this profile.",
    "Profile created and loaded. Its progress starts at zero.",
    "The other player is using this profile, so it cannot be deleted now.",
    "Confirmation 1 of 2: delete {{avatar}} {{name}} and all its saves, captures and stats?",
    "Confirmation 2 of 2: last step. {{avatar}} {{name}} and all its progress will be permanently deleted.",
    "Confirm (1/2)",
    "Delete permanently",
    "The active profile changed. Restart deletion from the selected profile.",
    "Deletion failed; the profile was not changed.",
    "Profile deleted with its saves and captures. Check which profile is loaded now.",
    "Deletion cancelled; the profile is kept.",
    "Profile loaded with its progress and captures.",
    "Block Match: each player battles the AI in their own run. Once both have won the required battles, they duel.",
    "Free Duo: each player plays their own AI run at their own pace. Use the option below to start a duel worth 1 point.",
    "Quick Battle: the computer immediately prepares two teams of six, then you duel. Solo profiles and progress are unchanged.",
    "The computer picks two balanced teams",
    "Pokémon are random, with the same level on both teams",
    "a shared random level",
    "level {{level}} for all 12 Pokémon",
    "Random Quick Battle: {{teams}} ({{level}}). There are no AI battles; the match starts with a 1-point duel.",
    "Free Duo: each player advances through their AI run at their own pace. Use Duel to play for 1 point.",
    "Free Duo: each player advances through their AI run at their own pace. Scored duels are disabled.",
    "Each block has {{ai}} AI battles per player and one shared duel. Across {{blocks}} blocks, that is {{pve}} AI battles per player and {{duels}} duels. A duel win earns 1 point; AI battles do not score points.",
    "Long match: expect to play across several sessions.",
    "Twelve different random Pokémon. Both teams share a level randomly chosen from 1 to 100.",
    "The computer creates two teams of six with similar base strength, then sets them to the same level.",
    "Ready ✓ — waiting for P2",
    "Ready ✓ — waiting for P1",
    "You are ready · waiting for P1.",
    "Waiting for P1's settings.",
  ],
  fr: [
    "PokéRogue 2Players",
    "JOUEUR 2",
    "Profil J{{player}}",
    "Choisir un profil",
    "Profil sélectionné : {{label}}",
    "Profil sélectionné",
    "Nom",
    "Icône",
    "Manette",
    "Étoile",
    "Feu",
    "Plante",
    "Eau",
    "Éclair",
    "Couleur",
    "Violet",
    "Rouge",
    "Bleu",
    "Vert",
    "Jaune",
    "Enregistrer",
    "Créer un profil avec ce nom",
    "Chaque profil garde ses parties, ses captures et ses réglages. Le supprimer efface ces données après deux confirmations.",
    "Supprimer ce profil",
    "Je confirme la suppression",
    "Annuler",
    "Prêt",
    "En attente des réglages de J1.",
    "2 JOUEURS",
    "JOUEUR 1 · CONFIGURATION",
    "Mode de jeu",
    "Duo libre",
    "Match à blocs",
    "Combat rapide aléatoire",
    "Combats dans un bloc",
    "{{total}} ({{ai}} IA + duel)",
    "Avec 10 combats au total, chacun gagne 9 combats contre l'IA avant d'affronter l'autre joueur en duel.",
    "Nombre de blocs",
    "Un bloc terminé déclenche un duel entre vous. Chaque duel gagné vaut 1 point ; les combats contre l'IA ne donnent pas de point.",
    "Pokémon capturés en renfort",
    "aucun",
    "Avant un duel, chacun peut remplacer jusqu'au nombre choisi de Pokémon par des captures de son profil. Les captures restent enregistrées.",
    "Niveaux des Pokémon",
    "Équilibrage automatique",
    "Garder les niveaux actuels",
    "En automatique, le duel s'aligne sur le joueur le moins avancé (arrondi par tranche de 5). Ce réglage ne change pas les niveaux sauvegardés.",
    "Permettre un duel en Duo libre (avec point)",
    "Équipes du duel",
    "Pokémon totalement aléatoires, niveaux équilibrés",
    "Équipes équilibrées, choisies par l'ordinateur",
    "Chaque joueur reçoit six Pokémon différents. Les deux équipes ont le même niveau.",
    "L'ordinateur crée deux équipes de six Pokémon de forces de base proches, puis les oppose à niveau égal.",
    "Niveau",
    "Niveau aléatoire, identique pour tous",
    "Choisir le niveau",
    "En mode aléatoire, les douze Pokémon ont le même niveau, choisi entre 1 et 100.",
    "Niveau choisi (1 à 100)",
    "Reprendre le match",
    "Prêt · lancer",
    "Deux progressions séparées : sauvegardes, réglages, profils et contrôles tactiles de chacun. La pause en cours de partie est commune.",
    "Tenez le téléphone en portrait pour jouer à deux.",
    "Victoires IA : {{pveBattlesWon}} · meilleure vague : {{bestRunWave}} · duels G/P/N : {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · matchs : {{matchesWon}}/{{matchesPlayed}} · Pokédex : {{seen}} vus, {{caught}} capturés",
    "Réserve de captures : {{count}} Pokémon",
    "aucune capture",
    "Ces copies peuvent remplacer des membres de l'équipe pour un duel, selon les règles du match.",
    "Profil sélectionné : ",
    "Terminez ou reprenez le match en cours avant de changer de profil.",
    "Profil personnalisé et enregistré.",
    "Entrez un nom pour ce profil.",
    "Profil créé et chargé. Sa partie commence à zéro.",
    "Ce profil est chargé par l'autre joueur et ne peut pas être supprimé maintenant.",
    "Confirmation 1 sur 2 : supprimer {{avatar}} {{name}} et toutes ses sauvegardes, captures et statistiques ?",
    "Confirmation 2 sur 2 : dernière étape. {{avatar}} {{name}} et toute sa progression seront effacés définitivement.",
    "Confirmer (1/2)",
    "Supprimer définitivement",
    "Le profil actif a changé. Recommencez la suppression depuis le bon profil.",
    "La suppression a échoué ; le profil n'a pas été modifié.",
    "Profil supprimé avec ses sauvegardes et ses captures. Vérifiez le profil maintenant chargé.",
    "Suppression annulée ; le profil est conservé.",
    "Profil chargé avec sa progression et ses captures.",
    "Match à blocs : chacun joue contre l'IA dans sa partie. Quand les deux ont gagné les combats prévus, ils s'affrontent en duel.",
    "Duo libre : chacun joue sa partie contre l'IA à son rythme. Activez l'option ci-dessous pour pouvoir lancer un duel qui rapporte 1 point.",
    "Combat rapide : l'ordinateur prépare immédiatement deux équipes de six Pokémon, puis vous jouez un duel. Aucun profil ni progression solo n'est modifié.",
    "L'ordinateur choisit deux équipes de force comparable",
    "Les Pokémon sont tirés au hasard, avec le même niveau des deux côtés",
    "niveau commun aléatoire",
    "niveau {{level}} pour les douze Pokémon",
    "Combat rapide aléatoire : {{teams}} ({{level}}). Aucun combat contre l'IA n'est joué ; le match commence par un duel qui rapporte 1 point.",
    "Duo libre : chacun joue sa partie contre l'IA et avance à son rythme. Le bouton Duel permet de s'affronter pour 1 point.",
    "Duo libre : chacun joue sa partie contre l'IA et avance à son rythme. Les duels avec points sont désactivés.",
    "Dans chaque bloc, chacun gagne {{ai}} combats contre l'IA, puis vous jouez un duel ensemble. {{blocks}} blocs = {{pve}} combats IA par joueur et {{duels}} duels partagés. Un duel gagné rapporte 1 point ; les combats IA ne rapportent pas de point.",
    "Match long : prévoyez plusieurs sessions.",
    "Douze Pokémon différents sont tirés au hasard. Les deux équipes ont le même niveau, choisi au hasard entre 1 et 100.",
    "L'ordinateur crée deux équipes de six Pokémon avec des forces de base proches, puis les oppose à niveau égal.",
    "Prêt ✓ — en attente de J2",
    "Prêt ✓ — en attente de J1",
    "Tu es prêt · en attente de J1.",
    "En attente des réglages de J1.",
  ],
  "es-ES": [
    "PokéRogue 2Players",
    "JUGADOR 2",
    "Perfil J{{player}}",
    "Elegir un perfil",
    "Perfil seleccionado: {{label}}",
    "Perfil seleccionado",
    "Nombre",
    "Icono",
    "Mando",
    "Estrella",
    "Fuego",
    "Planta",
    "Agua",
    "Rayo",
    "Color",
    "Morado",
    "Rojo",
    "Azul",
    "Verde",
    "Amarillo",
    "Guardar",
    "Crear un perfil con este nombre",
    "Cada perfil conserva sus partidas, capturas y ajustes. Al borrarlo, esos datos se eliminan tras dos confirmaciones.",
    "Eliminar este perfil",
    "Confirmar eliminación",
    "Cancelar",
    "Listo",
    "Esperando los ajustes de J1.",
    "2 JUGADORES",
    "JUGADOR 1 · CONFIGURACIÓN",
    "Modo de juego",
    "Dúo libre",
    "Partida por bloques",
    "Combate rápido aleatorio",
    "Combates por bloque",
    "{{total}} ({{ai}} contra la IA + duelo)",
    "Con 10 combates en total, cada jugador gana 9 contra la IA antes de enfrentarse al otro en un duelo.",
    "Número de bloques",
    "Al terminar cada bloque, jugaréis un duelo. Cada duelo ganado vale 1 punto; los combates contra la IA no dan puntos.",
    "Pokémon capturados como refuerzo",
    "Ninguno",
    "Antes de un duelo, cada jugador puede sustituir hasta el número elegido de Pokémon por capturas de su perfil. Las capturas se conservan.",
    "Niveles de los Pokémon",
    "Equilibrio automático",
    "Mantener los niveles actuales",
    "El modo automático iguala el duelo al jugador menos avanzado (redondeado hacia abajo en grupos de 5). No cambia los niveles guardados.",
    "Permitir un duelo con puntos en Dúo libre",
    "Equipos del duelo",
    "Pokémon totalmente aleatorios, niveles equilibrados",
    "Equipos equilibrados, elegidos por el ordenador",
    "Cada jugador recibe seis Pokémon distintos. Ambos equipos tienen el mismo nivel.",
    "El ordenador crea dos equipos de seis con una fuerza base similar y los iguala de nivel.",
    "Nivel",
    "Nivel aleatorio, igual para todos",
    "Elegir nivel",
    "En el modo aleatorio, los 12 Pokémon comparten un nivel elegido al azar entre 1 y 100.",
    "Nivel elegido (1 a 100)",
    "Reanudar partida",
    "Listo · empezar",
    "Progreso separado: cada jugador conserva sus partidas, ajustes, perfiles y controles táctiles. La pausa durante la partida es común.",
    "Mantén el teléfono en vertical para jugar a dos.",
    "Victorias contra IA: {{pveBattlesWon}} · mejor oleada: {{bestRunWave}} · duelos G/P/E: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · partidas: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} vistos, {{caught}} capturados",
    "Reserva de capturas: {{count}} Pokémon",
    "Sin capturas",
    "Estas copias pueden sustituir miembros del equipo para un duelo, según las reglas de la partida.",
    "Perfil seleccionado: ",
    "Termina o reanuda la partida actual antes de cambiar de perfil.",
    "Perfil guardado.",
    "Escribe un nombre para este perfil.",
    "Perfil creado y cargado. Su progreso empieza desde cero.",
    "El otro jugador está usando este perfil; ahora no se puede eliminar.",
    "Confirmación 1 de 2: ¿eliminar {{avatar}} {{name}} y todas sus partidas, capturas y estadísticas?",
    "Confirmación 2 de 2: último paso. Se eliminarán definitivamente {{avatar}} {{name}} y todo su progreso.",
    "Confirmar (1/2)",
    "Eliminar definitivamente",
    "El perfil activo ha cambiado. Vuelve a iniciar la eliminación desde el perfil correcto.",
    "No se pudo eliminar el perfil; no se ha modificado.",
    "Perfil eliminado con sus partidas y capturas. Comprueba qué perfil está cargado ahora.",
    "Eliminación cancelada; el perfil se conserva.",
    "Perfil cargado con su progreso y capturas.",
    "Partida por bloques: cada jugador combate contra la IA en su partida. Cuando ambos ganan los combates necesarios, se enfrentan en un duelo.",
    "Dúo libre: cada jugador avanza a su ritmo contra la IA. Activa la opción inferior para poder jugar un duelo por 1 punto.",
    "Combate rápido: el ordenador prepara dos equipos de seis Pokémon y empieza el duelo. No se modifican perfiles ni progreso en solitario.",
    "El ordenador elige dos equipos equilibrados",
    "Pokémon aleatorios con el mismo nivel en ambos equipos",
    "nivel común aleatorio",
    "nivel {{level}} para los 12 Pokémon",
    "Combate rápido aleatorio: {{teams}} ({{level}}). No hay combates contra la IA; la partida empieza con un duelo por 1 punto.",
    "Dúo libre: cada jugador avanza a su ritmo contra la IA. Usa Duelo para enfrentarte por 1 punto.",
    "Dúo libre: cada jugador avanza a su ritmo contra la IA. Los duelos con puntos están desactivados.",
    "Cada bloque incluye {{ai}} combates contra la IA por jugador y un duelo compartido. En {{blocks}} bloques: {{pve}} combates contra la IA por jugador y {{duels}} duelos. Cada duelo ganado vale 1 punto; la IA no da puntos.",
    "Partida larga: puede requerir varias sesiones.",
    "Se eligen al azar doce Pokémon distintos. Ambos equipos tienen el mismo nivel, elegido al azar entre 1 y 100.",
    "El ordenador crea dos equipos de seis Pokémon con fuerza base similar y los iguala de nivel.",
    "Listo ✓ — esperando a J2",
    "Listo ✓ — esperando a J1",
    "Estás listo · esperando a J1.",
    "Esperando los ajustes de J1.",
  ],
  de: [
    "PokéRogue 2Players",
    "SPIELER 2",
    "Profil S{{player}}",
    "Profil auswählen",
    "Ausgewähltes Profil: {{label}}",
    "Ausgewähltes Profil",
    "Name",
    "Symbol",
    "Gamepad",
    "Stern",
    "Feuer",
    "Pflanze",
    "Wasser",
    "Blitz",
    "Farbe",
    "Lila",
    "Rot",
    "Blau",
    "Grün",
    "Gelb",
    "Speichern",
    "Profil mit diesem Namen erstellen",
    "Jedes Profil speichert seine Läufe, Fänge und Einstellungen. Beim Löschen werden diese Daten nach zwei Bestätigungen entfernt.",
    "Dieses Profil löschen",
    "Löschen bestätigen",
    "Abbrechen",
    "Bereit",
    "Warte auf die Einstellungen von S1.",
    "2 SPIELER",
    "SPIELER 1 · EINSTELLUNGEN",
    "Spielmodus",
    "Freies Duo",
    "Block-Match",
    "Zufälliger Schnellkampf",
    "Kämpfe pro Block",
    "{{total}} ({{ai}} KI-Kampf + Duell)",
    "Bei insgesamt 10 Kämpfen gewinnt jeder 9 Kämpfe gegen die KI, bevor er gegen den anderen Spieler duelliert.",
    "Anzahl der Blöcke",
    "Nach jedem Block spielt ihr ein Duell. Jeder Duellsieg bringt 1 Punkt; KI-Kämpfe geben keine Punkte.",
    "Gefangene Pokémon als Verstärkung",
    "Keine",
    "Vor einem Duell kann jeder bis zu der gewählten Anzahl Pokémon durch Fänge aus seinem Profil ersetzen. Die Fänge bleiben gespeichert.",
    "Pokémon-Level",
    "Automatischer Ausgleich",
    "Aktuelle Level behalten",
    "Automatisch wird das Duell an das niedrigere Team-Level angepasst (abgerundet auf 5). Gespeicherte Level bleiben unverändert.",
    "Punkteduell im freien Duo erlauben",
    "Duellteams",
    "Völlig zufällige Pokémon, ausgeglichene Level",
    "Ausgewogene Teams, vom Computer gewählt",
    "Jeder erhält sechs verschiedene Pokémon. Beide Teams sind gleich hoch.",
    "Der Computer erstellt zwei Sechserteams mit ähnlicher Grundstärke und gleicht ihre Level an.",
    "Level",
    "Zufälliges Level, für alle gleich",
    "Level wählen",
    "Im Zufallsmodus erhalten alle 12 Pokémon dasselbe zufällige Level von 1 bis 100.",
    "Gewähltes Level (1 bis 100)",
    "Match fortsetzen",
    "Bereit · starten",
    "Getrennter Fortschritt: eigene Speicherstände, Einstellungen, Profile und Touch-Steuerung. Die Pause im Match gilt für beide.",
    "Halte das Telefon hochkant, um zu zweit zu spielen.",
    "KI-Siege: {{pveBattlesWon}} · beste Welle: {{bestRunWave}} · Duelle S/N/U: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · Matches: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} gesehen, {{caught}} gefangen",
    "Fangbank: {{count}} Pokémon",
    "Keine Fänge",
    "Diese Kopien können je nach Matchregeln Teammitglieder im Duell ersetzen.",
    "Ausgewähltes Profil: ",
    "Beende das aktuelle Match oder setze es fort, bevor du das Profil wechselst.",
    "Profil gespeichert.",
    "Gib einen Namen für dieses Profil ein.",
    "Profil erstellt und geladen. Der Fortschritt beginnt bei null.",
    "Dieses Profil wird vom anderen Spieler verwendet und kann jetzt nicht gelöscht werden.",
    "Bestätigung 1 von 2: {{avatar}} {{name}} samt Speicherständen, Fängen und Statistiken löschen?",
    "Bestätigung 2 von 2: letzter Schritt. {{avatar}} {{name}} und der gesamte Fortschritt werden endgültig gelöscht.",
    "Bestätigen (1/2)",
    "Endgültig löschen",
    "Das aktive Profil hat sich geändert. Starte das Löschen beim richtigen Profil erneut.",
    "Löschen fehlgeschlagen; das Profil wurde nicht geändert.",
    "Profil samt Speicherständen und Fängen gelöscht. Prüfe, welches Profil jetzt geladen ist.",
    "Löschen abgebrochen; das Profil bleibt erhalten.",
    "Profil mit Fortschritt und Fängen geladen.",
    "Block-Match: Jeder kämpft im eigenen Lauf gegen die KI. Sobald beide die nötigen Kämpfe gewonnen haben, folgt das Duell.",
    "Freies Duo: Jeder spielt seinen KI-Lauf im eigenen Tempo. Aktiviere unten die Option für ein Duell um 1 Punkt.",
    "Schnellkampf: Der Computer stellt sofort zwei Teams mit je sechs Pokémon zusammen. Dann beginnt das Duell. Solo-Profile bleiben unverändert.",
    "Der Computer wählt zwei ausgeglichene Teams",
    "Zufällige Pokémon mit gleichem Level auf beiden Seiten",
    "gemeinsames Zufallslevel",
    "Level {{level}} für alle 12 Pokémon",
    "Zufälliger Schnellkampf: {{teams}} ({{level}}). Ohne KI-Kämpfe; das Match beginnt mit einem Duell um 1 Punkt.",
    "Freies Duo: Jeder spielt seinen KI-Lauf im eigenen Tempo. Mit Duell spielt ihr um 1 Punkt.",
    "Freies Duo: Jeder spielt seinen KI-Lauf im eigenen Tempo. Punkteduelle sind deaktiviert.",
    "Pro Block spielt jeder {{ai}} KI-Kämpfe und ein gemeinsames Duell. In {{blocks}} Blöcken: {{pve}} KI-Kämpfe pro Spieler und {{duels}} Duelle. Ein Duellsieg bringt 1 Punkt; KI-Kämpfe keine.",
    "Langes Match: Plane mehrere Sitzungen ein.",
    "Zwölf verschiedene Pokémon werden zufällig gewählt. Beide Teams erhalten dasselbe Zufallslevel von 1 bis 100.",
    "Der Computer erstellt zwei Sechserteams mit ähnlicher Grundstärke und gleicht ihre Level an.",
    "Bereit ✓ — warte auf S2",
    "Bereit ✓ — warte auf S1",
    "Du bist bereit · warte auf S1.",
    "Warte auf die Einstellungen von S1.",
  ],
  it: [
    "PokéRogue 2Players",
    "GIOCATORE 2",
    "Profilo G{{player}}",
    "Scegli un profilo",
    "Profilo selezionato: {{label}}",
    "Profilo selezionato",
    "Nome",
    "Icona",
    "Controller",
    "Stella",
    "Fuoco",
    "Erba",
    "Acqua",
    "Fulmine",
    "Colore",
    "Viola",
    "Rosso",
    "Blu",
    "Verde",
    "Giallo",
    "Salva",
    "Crea un profilo con questo nome",
    "Ogni profilo conserva partite, catture e impostazioni. Eliminarlo cancella questi dati dopo due conferme.",
    "Elimina questo profilo",
    "Conferma eliminazione",
    "Annulla",
    "Pronto",
    "In attesa delle impostazioni di G1.",
    "2 GIOCATORI",
    "GIOCATORE 1 · CONFIGURAZIONE",
    "Modalità di gioco",
    "Duo libero",
    "Partita a blocchi",
    "Lotta rapida casuale",
    "Lotte per blocco",
    "{{total}} ({{ai}} contro IA + duello)",
    "Con 10 lotte totali, ciascuno vince 9 lotte contro l'IA prima di affrontare l'altro giocatore.",
    "Numero di blocchi",
    "Alla fine di ogni blocco giocherete un duello. Ogni vittoria vale 1 punto; le lotte contro l'IA non danno punti.",
    "Pokémon catturati come rinforzi",
    "Nessuno",
    "Prima di un duello, ciascuno può sostituire fino al numero scelto di Pokémon con catture del proprio profilo. Le catture restano salvate.",
    "Livelli dei Pokémon",
    "Bilanciamento automatico",
    "Mantieni i livelli attuali",
    "In automatico, il duello si adegua al giocatore meno avanzato (arrotondato per difetto a multipli di 5). I livelli salvati non cambiano.",
    "Consenti duelli a punti in Duo libero",
    "Squadre del duello",
    "Pokémon del tutto casuali, livelli bilanciati",
    "Squadre bilanciate, scelte dal computer",
    "Ogni giocatore riceve sei Pokémon diversi. Le due squadre hanno lo stesso livello.",
    "Il computer crea due squadre da sei con una forza base simile e pareggia i livelli.",
    "Livello",
    "Livello casuale, uguale per tutti",
    "Scegli livello",
    "In modalità casuale, tutti i 12 Pokémon condividono un livello scelto a caso da 1 a 100.",
    "Livello scelto (1-100)",
    "Riprendi la partita",
    "Pronto · inizia",
    "Progressi separati: salvataggi, impostazioni, profili e controlli touch distinti. La pausa durante la partita è condivisa.",
    "Tieni il telefono in verticale per giocare in due.",
    "Vittorie IA: {{pveBattlesWon}} · ondata migliore: {{bestRunWave}} · duelli V/P/P: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · partite: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} visti, {{caught}} catturati",
    "Riserva catture: {{count}} Pokémon",
    "Nessuna cattura",
    "Queste copie possono sostituire membri della squadra nel duello, in base alle regole della partita.",
    "Profilo selezionato: ",
    "Termina o riprendi la partita in corso prima di cambiare profilo.",
    "Profilo salvato.",
    "Inserisci un nome per questo profilo.",
    "Profilo creato e caricato. I progressi partono da zero.",
    "Questo profilo è in uso dall'altro giocatore e non può essere eliminato ora.",
    "Conferma 1 di 2: eliminare {{avatar}} {{name}} e tutti i salvataggi, le catture e le statistiche?",
    "Conferma 2 di 2: ultimo passaggio. {{avatar}} {{name}} e tutti i progressi saranno eliminati definitivamente.",
    "Conferma (1/2)",
    "Elimina definitivamente",
    "Il profilo attivo è cambiato. Ricomincia l'eliminazione dal profilo selezionato.",
    "Eliminazione non riuscita; il profilo non è stato modificato.",
    "Profilo eliminato con salvataggi e catture. Controlla quale profilo è caricato ora.",
    "Eliminazione annullata; il profilo è conservato.",
    "Profilo caricato con progressi e catture.",
    "Partita a blocchi: ciascuno affronta l'IA nella propria partita. Quando entrambi vincono le lotte richieste, si sfidano in duello.",
    "Duo libero: ciascuno gioca la propria partita contro l'IA al proprio ritmo. Attiva l'opzione qui sotto per un duello da 1 punto.",
    "Lotta rapida: il computer prepara subito due squadre da sei Pokémon, poi inizia il duello. Profili e progressi in solitaria non cambiano.",
    "Il computer sceglie due squadre bilanciate",
    "Pokémon casuali, stesso livello per entrambe le squadre",
    "livello casuale comune",
    "livello {{level}} per tutti i 12 Pokémon",
    "Lotta rapida casuale: {{teams}} ({{level}}). Nessuna lotta contro l'IA; la partita inizia con un duello da 1 punto.",
    "Duo libero: ciascuno avanza nella propria partita IA. Usa Duello per sfidarsi per 1 punto.",
    "Duo libero: ciascuno avanza nella propria partita IA. I duelli a punti sono disattivati.",
    "Ogni blocco include {{ai}} lotte IA per giocatore e un duello condiviso. In {{blocks}} blocchi: {{pve}} lotte IA a testa e {{duels}} duelli. Ogni vittoria nel duello vale 1 punto; le lotte IA no.",
    "Partita lunga: potrebbero servire più sessioni.",
    "Dodici Pokémon diversi scelti a caso. Entrambe le squadre hanno lo stesso livello casuale, da 1 a 100.",
    "Il computer crea due squadre da sei con forza base simile e pareggia i livelli.",
    "Pronto ✓ — in attesa di G2",
    "Pronto ✓ — in attesa di G1",
    "Sei pronto · in attesa di G1.",
    "In attesa delle impostazioni di G1.",
  ],
  "pt-BR": [
    "PokéRogue 2Players",
    "JOGADOR 2",
    "Perfil J{{player}}",
    "Escolher um perfil",
    "Perfil selecionado: {{label}}",
    "Perfil selecionado",
    "Nome",
    "Ícone",
    "Controle",
    "Estrela",
    "Fogo",
    "Planta",
    "Água",
    "Raio",
    "Cor",
    "Roxo",
    "Vermelho",
    "Azul",
    "Verde",
    "Amarelo",
    "Salvar",
    "Criar um perfil com este nome",
    "Cada perfil guarda suas partidas, capturas e configurações. Excluí-lo apaga esses dados após duas confirmações.",
    "Excluir este perfil",
    "Confirmar exclusão",
    "Cancelar",
    "Pronto",
    "Aguardando as configurações do J1.",
    "2 JOGADORES",
    "JOGADOR 1 · CONFIGURAÇÃO",
    "Modo de jogo",
    "Dupla livre",
    "Partida por blocos",
    "Batalha rápida aleatória",
    "Batalhas por bloco",
    "{{total}} ({{ai}} contra a IA + duelo)",
    "Com 10 batalhas no total, cada jogador vence 9 contra a IA antes de enfrentar o outro em um duelo.",
    "Número de blocos",
    "Cada bloco concluído inicia um duelo. Cada vitória no duelo vale 1 ponto; batalhas contra a IA não dão pontos.",
    "Pokémon capturados como reforços",
    "Nenhum",
    "Antes do duelo, cada jogador pode trocar até o número escolhido de Pokémon por capturas do próprio perfil. As capturas continuam salvas.",
    "Níveis dos Pokémon",
    "Balanceamento automático",
    "Manter níveis atuais",
    "No automático, o duelo usa o nível do jogador menos avançado (arredondado para baixo em grupos de 5). Os níveis salvos não mudam.",
    "Permitir duelo valendo ponto na Dupla livre",
    "Equipes do duelo",
    "Pokémon totalmente aleatórios, níveis equilibrados",
    "Equipes equilibradas, escolhidas pelo computador",
    "Cada jogador recebe seis Pokémon diferentes. As duas equipes têm o mesmo nível.",
    "O computador cria duas equipes de seis com força base parecida e iguala os níveis.",
    "Nível",
    "Nível aleatório, igual para todos",
    "Escolher nível",
    "No modo aleatório, os 12 Pokémon recebem o mesmo nível, escolhido entre 1 e 100.",
    "Nível escolhido (1 a 100)",
    "Retomar partida",
    "Pronto · iniciar",
    "Progresso separado: cada jogador tem seus próprios saves, configurações, perfis e controles táteis. A pausa durante a partida é compartilhada.",
    "Mantenha o celular na vertical para jogar em dupla.",
    "Vitórias contra IA: {{pveBattlesWon}} · melhor onda: {{bestRunWave}} · duelos V/D/E: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · partidas: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} vistos, {{caught}} capturados",
    "Reserva de capturas: {{count}} Pokémon",
    "Nenhuma captura",
    "Estas cópias podem substituir membros da equipe no duelo, conforme as regras da partida.",
    "Perfil selecionado: ",
    "Termine ou retome a partida atual antes de trocar de perfil.",
    "Perfil salvo.",
    "Digite um nome para este perfil.",
    "Perfil criado e carregado. O progresso começa do zero.",
    "O outro jogador está usando este perfil, então ele não pode ser excluído agora.",
    "Confirmação 1 de 2: excluir {{avatar}} {{name}} e todos os saves, capturas e estatísticas?",
    "Confirmação 2 de 2: última etapa. {{avatar}} {{name}} e todo o progresso serão apagados permanentemente.",
    "Confirmar (1/2)",
    "Excluir permanentemente",
    "O perfil ativo mudou. Comece a exclusão novamente pelo perfil selecionado.",
    "Falha ao excluir; o perfil não foi alterado.",
    "Perfil excluído com seus saves e capturas. Confira qual perfil está carregado agora.",
    "Exclusão cancelada; o perfil foi mantido.",
    "Perfil carregado com progresso e capturas.",
    "Partida por blocos: cada jogador enfrenta a IA em sua própria partida. Quando ambos vencem as batalhas previstas, duelam.",
    "Dupla livre: cada um joga sua partida contra a IA no próprio ritmo. Ative a opção abaixo para iniciar um duelo que vale 1 ponto.",
    "Batalha rápida: o computador prepara duas equipes de seis Pokémon e inicia o duelo. Perfis e progresso solo não são alterados.",
    "O computador escolhe duas equipes equilibradas",
    "Pokémon aleatórios, com o mesmo nível nos dois lados",
    "nível aleatório comum",
    "nível {{level}} para os 12 Pokémon",
    "Batalha rápida aleatória: {{teams}} ({{level}}). Sem batalhas contra a IA; a partida começa com um duelo valendo 1 ponto.",
    "Dupla livre: cada jogador avança na própria partida contra a IA. Use Duelo para jogar por 1 ponto.",
    "Dupla livre: cada jogador avança na própria partida contra a IA. Duelos valendo pontos estão desativados.",
    "Cada bloco tem {{ai}} batalhas contra IA por jogador e um duelo compartilhado. Em {{blocks}} blocos: {{pve}} batalhas contra IA por jogador e {{duels}} duelos. Cada vitória no duelo vale 1 ponto; batalhas contra IA não dão pontos.",
    "Partida longa: talvez seja preciso jogar em várias sessões.",
    "Doze Pokémon diferentes são sorteados. As equipes ficam no mesmo nível, escolhido aleatoriamente entre 1 e 100.",
    "O computador monta duas equipes de seis com força base parecida e iguala os níveis.",
    "Pronto ✓ — aguardando J2",
    "Pronto ✓ — aguardando J1",
    "Você está pronto · aguardando J1.",
    "Aguardando as configurações do J1.",
  ],
  ca: [
    "PokéRogue 2Players",
    "JUGADOR 2",
    "Perfil J{{player}}",
    "Tria un perfil",
    "Perfil seleccionat: {{label}}",
    "Perfil seleccionat",
    "Nom",
    "Icona",
    "Comandament",
    "Estrella",
    "Foc",
    "Planta",
    "Aigua",
    "Llamp",
    "Color",
    "Lila",
    "Vermell",
    "Blau",
    "Verd",
    "Groc",
    "Desa",
    "Crea un perfil amb aquest nom",
    "Cada perfil conserva les seves partides, captures i opcions. En eliminar-lo, aquestes dades s'esborren després de dues confirmacions.",
    "Elimina aquest perfil",
    "Confirma l'eliminació",
    "Cancel·la",
    "Preparat",
    "Esperant les opcions de J1.",
    "2 JUGADORS",
    "JUGADOR 1 · CONFIGURACIÓ",
    "Mode de joc",
    "Duo lliure",
    "Partida per blocs",
    "Combat ràpid aleatori",
    "Combats per bloc",
    "{{total}} ({{ai}} contra la IA + duel)",
    "Amb 10 combats en total, cada jugador en guanya 9 contra la IA abans d'enfrontar-se a l'altre en duel.",
    "Nombre de blocs",
    "Cada bloc completat inicia un duel. Cada duel guanyat val 1 punt; els combats contra la IA no donen punts.",
    "Pokémon capturats com a reforç",
    "Cap",
    "Abans d'un duel, cada jugador pot substituir fins al nombre escollit de Pokémon per captures del seu perfil. Les captures es conserven.",
    "Nivells dels Pokémon",
    "Equilibri automàtic",
    "Conserva els nivells actuals",
    "En automàtic, el duel s'ajusta al jugador menys avançat (arrodonit a la baixa de 5 en 5). Els nivells desats no canvien.",
    "Permet un duel amb punts al Duo lliure",
    "Equips del duel",
    "Pokémon totalment aleatoris, nivells equilibrats",
    "Equips equilibrats, triats per l'ordinador",
    "Cada jugador rep sis Pokémon diferents. Els dos equips tenen el mateix nivell.",
    "L'ordinador crea dos equips de sis amb una força base semblant i iguala els nivells.",
    "Nivell",
    "Nivell aleatori, igual per a tothom",
    "Tria el nivell",
    "En mode aleatori, els 12 Pokémon comparteixen un nivell triat a l'atzar entre 1 i 100.",
    "Nivell triat (1 a 100)",
    "Reprèn la partida",
    "Preparat · comença",
    "Progrés separat: cada jugador té desats, opcions, perfils i controls tàctils propis. La pausa durant la partida és compartida.",
    "Mantén el telèfon en vertical per jugar en duo.",
    "Victòries IA: {{pveBattlesWon}} · millor onada: {{bestRunWave}} · duels G/P/E: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · partides: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} vistos, {{caught}} capturats",
    "Reserva de captures: {{count}} Pokémon",
    "Cap captura",
    "Aquestes còpies poden substituir membres de l'equip en un duel, segons les regles de la partida.",
    "Perfil seleccionat: ",
    "Acaba o reprèn la partida actual abans de canviar de perfil.",
    "Perfil desat.",
    "Escriu un nom per a aquest perfil.",
    "Perfil creat i carregat. El progrés comença de zero.",
    "L'altre jugador està fent servir aquest perfil i ara no es pot eliminar.",
    "Confirmació 1 de 2: elimina {{avatar}} {{name}} i tots els seus desats, captures i estadístiques?",
    "Confirmació 2 de 2: últim pas. {{avatar}} {{name}} i tot el seu progrés s'esborraran definitivament.",
    "Confirma (1/2)",
    "Elimina definitivament",
    "El perfil actiu ha canviat. Torna a iniciar l'eliminació des del perfil seleccionat.",
    "No s'ha pogut eliminar; el perfil no s'ha modificat.",
    "Perfil eliminat amb les partides i captures. Comprova quin perfil està carregat ara.",
    "Eliminació cancel·lada; el perfil es conserva.",
    "Perfil carregat amb el seu progrés i captures.",
    "Partida per blocs: cada jugador lluita contra la IA en la seva partida. Quan tots dos guanyen els combats necessaris, s'enfronten en duel.",
    "Duo lliure: cadascú juga la seva partida contra la IA al seu ritme. Activa l'opció de sota per jugar un duel que val 1 punt.",
    "Combat ràpid: l'ordinador prepara dos equips de sis Pokémon i comença el duel. No es canvien els perfils ni el progrés en solitari.",
    "L'ordinador tria dos equips equilibrats",
    "Pokémon aleatoris, amb el mateix nivell als dos equips",
    "nivell aleatori compartit",
    "nivell {{level}} per als 12 Pokémon",
    "Combat ràpid aleatori: {{teams}} ({{level}}). No hi ha combats contra la IA; la partida comença amb un duel que val 1 punt.",
    "Duo lliure: cadascú avança en la seva partida contra la IA. Fes servir Duel per jugar per 1 punt.",
    "Duo lliure: cadascú avança en la seva partida contra la IA. Els duels amb punts estan desactivats.",
    "Cada bloc inclou {{ai}} combats IA per jugador i un duel compartit. En {{blocks}} blocs: {{pve}} combats IA per jugador i {{duels}} duels. Cada duel guanyat val 1 punt; els combats IA no en donen.",
    "Partida llarga: pot caldre jugar en diverses sessions.",
    "Se sortegen dotze Pokémon diferents. Tots dos equips comparteixen un nivell aleatori entre 1 i 100.",
    "L'ordinador crea dos equips de sis amb una força base semblant i iguala els nivells.",
    "Preparat ✓ — esperant J2",
    "Preparat ✓ — esperant J1",
    "Ja estàs preparat · esperant J1.",
    "Esperant les opcions de J1.",
  ],
  eu: [
    "PokéRogue 2Players",
    "2. JOKALARIA",
    "J{{player}} profila",
    "Aukeratu profil bat",
    "Hautatutako profila: {{label}}",
    "Hautatutako profila",
    "Izena",
    "Ikonoa",
    "Kontrolagailua",
    "Izarra",
    "Sua",
    "Landarea",
    "Ura",
    "Tximista",
    "Kolorea",
    "Morea",
    "Gorria",
    "Urdina",
    "Berdea",
    "Horia",
    "Gorde",
    "Sortu profila izen honekin",
    "Profil bakoitzak bere partidak, harrapaketak eta ezarpenak gordetzen ditu. Ezabatzeak datu horiek kentzen ditu, bi berrespenen ondoren.",
    "Ezabatu profil hau",
    "Berretsi ezabatzea",
    "Utzi",
    "Prest",
    "J1en ezarpenen zain.",
    "2 JOKALARI",
    "1. JOKALARIA · KONFIGURAZIOA",
    "Joko-modua",
    "Duo librea",
    "Bloke-partida",
    "Ausazko borroka azkarra",
    "Borroka bloke bakoitzean",
    "{{total}} ({{ai}} IAren aurka + duelua)",
    "Guztira 10 borrokarekin, jokalari bakoitzak 9 irabazten ditu IAren aurka, beste jokalariarekin duelua izan aurretik.",
    "Bloke kopurua",
    "Bloke bakoitza amaitzean duelu bat jokatuko duzue. Duelu bakoitzak puntu 1 ematen du; IAren aurkako borrokek ez dute punturik ematen.",
    "Harrapatutako Pokémon errefortzu gisa",
    "Bat ere ez",
    "Duelu baten aurretik, jokalari bakoitzak aukeratutako kopurura arteko Pokémonak bere profileko harrapaketekin ordezka ditzake. Harrapaketak gordeta geratzen dira.",
    "Pokémonen mailak",
    "Orekatze automatikoa",
    "Mantendu uneko mailak",
    "Automatikoan, duelua gutxien aurreratu den jokalariaren mailara egokitzen da (5eko beheranzko biribiltzea). Gordetako mailak ez dira aldatzen.",
    "Baimendu puntudun dueluak Duo librean",
    "Duelurako taldeak",
    "Pokémon guztiz ausazkoak, maila orekatuak",
    "Talde orekatuak, ordenagailuak aukeratuta",
    "Jokalari bakoitzak sei Pokémon desberdin jasotzen ditu. Bi taldeek maila bera dute.",
    "Ordenagailuak oinarrizko indar antzekoa duten sei Pokémonen bi talde sortzen ditu, eta mailak berdintzen ditu.",
    "Maila",
    "Ausazko maila, guztientzat bera",
    "Aukeratu maila",
    "Ausazko moduan, 12 Pokémon guztiek 1 eta 100 arteko ausazko maila bera dute.",
    "Aukeratutako maila (1-100)",
    "Jarraitu partida",
    "Prest · hasi",
    "Aurrerapen bereiziak: jokalari bakoitzak bere gordetzeak, ezarpenak, profilak eta ukipen-kontrolak ditu. Partidako pausa partekatua da.",
    "Eduki telefonoa bertikalean, bi jokalarirekin aritzeko.",
    "IAren aurkako garaipenak: {{pveBattlesWon}} · olatu onena: {{bestRunWave}} · dueluak G/G/B: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · partidak: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} ikusita, {{caught}} harrapatuta",
    "Harrapaketen biltegia: {{count}} Pokémon",
    "Harrapaketarik ez",
    "Kopia hauek taldeko kideak ordezka ditzakete duelu batean, partidaren arauen arabera.",
    "Hautatutako profila: ",
    "Amaitu edo jarraitu uneko partida profilaz aldatu aurretik.",
    "Profila gordeta.",
    "Idatzi profil honen izena.",
    "Profila sortu eta kargatu da. Aurrerapena zerotik hasten da.",
    "Beste jokalaria profil hau erabiltzen ari da; ezin da orain ezabatu.",
    "1/2 berrespena: ezabatu {{avatar}} {{name}} eta haren gordetze, harrapaketa eta estatistika guztiak?",
    "2/2 berrespena: azken urratsa. {{avatar}} {{name}} eta haren aurrerapen guztia behin betiko ezabatuko dira.",
    "Berretsi (1/2)",
    "Ezabatu behin betiko",
    "Profil aktiboa aldatu da. Hasi berriro ezabatzea hautatutako profiletik.",
    "Ezin izan da ezabatu; profila ez da aldatu.",
    "Profila eta gordetzeak eta harrapaketak ezabatu dira. Egiaztatu zein profil dagoen kargatuta.",
    "Ezabatzea bertan behera utzi da; profila mantendu da.",
    "Profila kargatuta, aurrerapen eta harrapaketekin.",
    "Bloke-partida: jokalari bakoitzak IAren aurka jokatzen du bere partidan. Behar diren borrokak irabaztean, biek duelua jokatzen dute.",
    "Duo librea: bakoitzak bere IAren aurkako partida nahi duen erritmoan jokatzen du. Aktibatu beheko aukera puntu 1eko duelua hasteko.",
    "Borroka azkarrean, ordenagailuak sei Pokémoneko bi talde prestatzen ditu eta duelua hasten da. Profil eta aurrerapen soloak ez dira aldatzen.",
    "Ordenagailuak bi talde orekatu aukeratzen ditu",
    "Ausazko Pokémonak, bi taldeentzat maila bera",
    "ausazko maila komuna",
    "{{level}} maila 12 Pokémonentzat",
    "Ausazko borroka azkarra: {{teams}} ({{level}}). Ez dago IAren aurkako borrokarik; partida puntu 1eko dueloarekin hasten da.",
    "Duo librea: bakoitzak bere IAren aurkako partidan aurrera egiten du. Erabili Duelua puntu 1engatik jokatzeko.",
    "Duo librea: bakoitzak bere IAren aurkako partidan aurrera egiten du. Puntudun dueluak desgaituta daude.",
    "Bloke bakoitzean, jokalari bakoitzak {{ai}} IA-borroka eta duelu partekatu bat ditu. {{blocks}} bloketan: {{pve}} IA-borroka jokalari bakoitzeko eta {{duels}} duelu. Duelu bat irabazteak puntu 1 ematen du; IA-borroketek ez.",
    "Partida luzea: hainbat saiotan jokatu beharko duzu.",
    "Hamabi Pokémon desberdin ausaz aukeratzen dira. Bi taldeek 1 eta 100 arteko maila bera dute.",
    "Ordenagailuak oinarrizko indar antzeko sei Pokémoneko bi talde sortzen ditu eta maila bera ezartzen die.",
    "Prest ✓ — J2ren zain",
    "Prest ✓ — J1en zain",
    "Prest zaude · J1en zain.",
    "J1en ezarpenen zain.",
  ],
};

// Keep the less common solo languages available to the compact Android shell.
// Each newline is one entry in MESSAGE_KEYS; missing a line fails validation.
const EXTRA_LOCALE_TEXT = {
  tr: `PokéRogue 2Players
OYUNCU 2
Oyuncu {{player}} profili
Profil seç
Seçili profil: {{label}}
Seçili profil
Ad
Simge
Oyun kumandası
Yıldız
Ateş
Çimen
Su
Yıldırım
Renk
Mor
Kırmızı
Mavi
Yeşil
Sarı
Kaydet
Bu adla profil oluştur
Her profil oyunlarını, yakalamalarını ve ayarlarını saklar. Silme işlemi iki onaydan sonra bu verileri de siler.
Bu profili sil
Silmeyi onayla
İptal
Hazır
Oyuncu 1'in ayarları bekleniyor.
2 OYUNCU
OYUNCU 1 · AYARLAR
Oyun modu
Serbest İkili
Blok Maçı
Rastgele Hızlı Savaş
Her bloktaki savaş sayısı
{{total}} ({{ai}} yapay zekâ + düello)
Toplam 10 savaşta her oyuncu, diğer oyuncuyla düello yapmadan önce yapay zekâya karşı 9 savaş kazanır.
Blok sayısı
Her blok bittiğinde birlikte düello yaparsınız. Kazanılan her düello 1 puan getirir; yapay zekâ savaşları puan kazandırmaz.
Takviye olarak yakalanan Pokémonlar
Yok
Düellodan önce her oyuncu, takımındaki en fazla seçilen sayıdaki Pokémonu profilindeki yakalamalarla değiştirebilir. Yakalamalar kaydedilmeye devam eder.
Pokémon seviyeleri
Otomatik dengeleme
Mevcut seviyeleri koru
Otomatik ayar, düelloyu daha az ilerlemiş oyuncunun seviyesine göre ayarlar ve 5'in katına aşağı yuvarlar. Kayıtlı seviyeler değişmez.
Serbest İkili'de puanlı düelloya izin ver
Düello takımları
Tamamen rastgele Pokémonlar, dengeli seviyeler
Bilgisayarın seçtiği dengeli takımlar
Her oyuncuya altı farklı Pokémon verilir. İki takımın seviyesi aynıdır.
Bilgisayar, temel güçleri benzer iki altılı takım kurar ve seviyelerini eşitler.
Seviye
Herkes için aynı rastgele seviye
Seviye seç
Rastgele modda 12 Pokémonun tamamı 1 ile 100 arasında rastgele seçilen aynı seviyede olur.
Seçilen seviye (1–100)
Maça devam et
Hazır · başlat
İlerleme ayrı tutulur: her oyuncunun kayıtları, ayarları, profilleri ve dokunmatik kontrolleri ayrıdır. Oyun içi duraklatma ortaktır.
İki kişi oynamak için telefonu dik tutun.
Yapay zekâ galibiyetleri: {{pveBattlesWon}} · en iyi dalga: {{bestRunWave}} · düellolar G/M/B: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · maçlar: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} görüldü, {{caught}} yakalandı
Yakalama deposu: {{count}} Pokémon
Yakalama yok
Maç kurallarına göre bu kopyalar düelloda takım üyelerinin yerine seçilebilir.
Seçili profil:
Profilleri değiştirmeden önce devam eden maçı bitirin veya kaldığı yerden açın.
Profil kaydedildi.
Bu profil için bir ad girin.
Profil oluşturuldu ve yüklendi. İlerlemesi sıfırdan başlar.
Bu profili diğer oyuncu kullanıyor; şu anda silinemez.
1/2 onay: {{avatar}} {{name}} ve tüm kayıtları, yakalamaları ve istatistikleri silinsin mi?
2/2 onay: son adım. {{avatar}} {{name}} ve tüm ilerlemesi kalıcı olarak silinecek.
Onayla (1/2)
Kalıcı olarak sil
Etkin profil değişti. Silme işlemini seçili profilden yeniden başlatın.
Silme başarısız; profil değiştirilmedi.
Profil kayıtları ve yakalamalarıyla silindi. Şimdi hangi profilin yüklü olduğunu kontrol edin.
Silme iptal edildi; profil korundu.
Profil ilerlemesi ve yakalamalarıyla yüklendi.
Blok Maçı: Her oyuncu kendi oyununda yapay zekâyla savaşır. İkisi de gereken savaşları kazanınca düello yaparlar.
Serbest İkili: Her oyuncu kendi yapay zekâ oyununda istediği hızda ilerler. Bir puanlık düello başlatmak için aşağıdaki seçeneği açın.
Hızlı Savaş: Bilgisayar hemen altı Pokémonluk iki takım hazırlar, sonra düello başlar. Tek oyunculu profiller ve ilerleme değişmez.
Bilgisayar gücü dengeli iki takım seçer
İki tarafta aynı seviyede rastgele Pokémonlar
ortak rastgele seviye
12 Pokémonun hepsi seviye {{level}}
Rastgele Hızlı Savaş: {{teams}} ({{level}}). Yapay zekâ savaşı yoktur; maç bir puanlık düelloyla başlar.
Serbest İkili: Her oyuncu yapay zekâ oyununda kendi hızında ilerler. Bir puan için Düello'yu kullanın.
Serbest İkili: Her oyuncu yapay zekâ oyununda kendi hızında ilerler. Puanlı düellolar kapalı.
Her blokta oyuncu başına {{ai}} yapay zekâ savaşı ve ortak bir düello vardır. {{blocks}} blokta: oyuncu başına {{pve}} yapay zekâ savaşı ve {{duels}} düello. Düelloyu kazanmak 1 puan verir; yapay zekâ savaşları puan vermez.
Uzun maç: birkaç oturum boyunca oynamanız gerekebilir.
On iki farklı Pokémon rastgele seçilir. İki takım da 1 ile 100 arasında rastgele seçilen aynı seviyeye sahip olur.
Bilgisayar, temel güçleri benzer iki altılı takım kurar ve seviyelerini eşitler.
Hazır ✓ — Oyuncu 2 bekleniyor
Hazır ✓ — Oyuncu 1 bekleniyor
Hazırsınız · Oyuncu 1 bekleniyor.
Oyuncu 1'in ayarları bekleniyor.`,
  ru: `PokéRogue 2Players
ИГРОК 2
Профиль игрока {{player}}
Выбрать профиль
Выбранный профиль: {{label}}
Выбранный профиль
Имя
Значок
Геймпад
Звезда
Огонь
Трава
Вода
Молния
Цвет
Фиолетовый
Красный
Синий
Зелёный
Жёлтый
Сохранить
Создать профиль с этим именем
В каждом профиле хранятся забеги, поимки и настройки. Удаление после двух подтверждений также удалит эти данные.
Удалить этот профиль
Подтвердить удаление
Отмена
Готово
Ожидание настроек игрока 1.
2 ИГРОКА
ИГРОК 1 · НАСТРОЙКА
Режим игры
Свободная пара
Матч блоками
Случайный быстрый бой
Боёв в каждом блоке
{{total}} ({{ai}} против ИИ + дуэль)
Всего 10 боёв: каждый игрок побеждает ИИ в 9 боях, а затем сражается с другим игроком в дуэли.
Количество блоков
После каждого блока вы играете дуэль. Победа в дуэли даёт 1 очко; бои с ИИ очков не дают.
Пойманные покемоны для подкрепления
Нет
Перед дуэлью каждый игрок может заменить выбранное число покемонов своей команды пойманными покемонами из профиля. Они останутся в хранилище.
Уровни покемонов
Автоматическое выравнивание
Сохранить текущие уровни
Автоматический режим подстраивает дуэль под менее продвинутого игрока, округляя уровень вниз до 5. Сохранённые уровни не меняются.
Разрешить дуэль за очко в свободной паре
Команды для дуэли
Полностью случайные покемоны, сбалансированные уровни
Сбалансированные команды выберет компьютер
Каждый игрок получает шесть разных покемонов. Уровни обеих команд одинаковы.
Компьютер создаёт две команды по шесть покемонов с похожей базовой силой и выравнивает их уровни.
Уровень
Случайный уровень, одинаковый для всех
Выбрать уровень
В случайном режиме все 12 покемонов получают один случайный уровень от 1 до 100.
Выбранный уровень (1–100)
Продолжить матч
Готово · начать
Прогресс раздельный: у каждого игрока свои сохранения, настройки, профили и сенсорное управление. Пауза в игре общая.
Держите телефон вертикально, чтобы играть вдвоём.
Победы над ИИ: {{pveBattlesWon}} · лучшая волна: {{bestRunWave}} · дуэли В/П/Н: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · матчи: {{matchesWon}}/{{matchesPlayed}} · Покедекс: увидено {{seen}}, поймано {{caught}}
Хранилище поимок: {{count}} покемонов
Нет пойманных покемонов
Эти копии можно выбрать вместо участников команды для дуэли, согласно правилам матча.
Выбранный профиль:
Завершите или возобновите текущий матч, прежде чем менять профиль.
Профиль сохранён.
Введите имя профиля.
Профиль создан и загружен. Прогресс начинается с нуля.
Этот профиль использует другой игрок, поэтому сейчас его нельзя удалить.
Подтверждение 1 из 2: удалить {{avatar}} {{name}} и все его сохранения, поимки и статистику?
Подтверждение 2 из 2: последний шаг. {{avatar}} {{name}} и весь его прогресс будут удалены безвозвратно.
Подтвердить (1/2)
Удалить навсегда
Активный профиль изменился. Начните удаление заново для выбранного профиля.
Не удалось удалить профиль; данные не изменены.
Профиль удалён вместе с сохранениями и поимками. Проверьте, какой профиль загружен сейчас.
Удаление отменено; профиль сохранён.
Профиль загружен с прогрессом и поимками.
Матч блоками: каждый игрок сражается с ИИ в своём забеге. Когда оба выиграют нужное число боёв, они встретятся в дуэли.
Свободная пара: каждый проходит свой забег против ИИ в удобном темпе. Включите параметр ниже, чтобы играть в дуэль за 1 очко.
Быстрый бой: компьютер сразу готовит две команды по шесть покемонов, затем начинается дуэль. Одиночные профили и прогресс не меняются.
Компьютер выбирает две сбалансированные команды
Случайные покемоны, одинаковый уровень у обеих команд
общий случайный уровень
уровень {{level}} для всех 12 покемонов
Случайный быстрый бой: {{teams}} ({{level}}). Боёв с ИИ нет; матч начинается с дуэли за 1 очко.
Свободная пара: каждый продолжает свой забег против ИИ в своём темпе. Нажмите «Дуэль», чтобы сыграть за 1 очко.
Свободная пара: каждый продолжает свой забег против ИИ в своём темпе. Дуэли за очки отключены.
В каждом блоке на игрока приходится {{ai}} боёв с ИИ и одна общая дуэль. За {{blocks}} блоков: {{pve}} боёв с ИИ на игрока и {{duels}} дуэлей. Победа в дуэли даёт 1 очко; бои с ИИ очков не дают.
Долгий матч: возможно, придётся играть несколько раз.
Случайно выбираются двенадцать разных покемонов. У обеих команд будет один случайный уровень от 1 до 100.
Компьютер создаёт две команды по шесть покемонов с похожей базовой силой и выравнивает их уровни.
Готово ✓ — ожидание игрока 2
Готово ✓ — ожидание игрока 1
Вы готовы · ожидание игрока 1.
Ожидание настроек игрока 1.`,
  uk: `PokéRogue 2Players
ГРАВЕЦЬ 2
Профіль гравця {{player}}
Вибрати профіль
Вибраний профіль: {{label}}
Вибраний профіль
Ім’я
Значок
Геймпад
Зірка
Вогонь
Трава
Вода
Блискавка
Колір
Фіолетовий
Червоний
Синій
Зелений
Жовтий
Зберегти
Створити профіль із цим ім’ям
У кожному профілі зберігаються забіги, спіймані покемони й налаштування. Після двох підтверджень видаляються також усі ці дані.
Видалити цей профіль
Підтвердити видалення
Скасувати
Готово
Очікування налаштувань гравця 1.
2 ГРАВЦІ
ГРАВЕЦЬ 1 · НАЛАШТУВАННЯ
Режим гри
Вільна пара
Матч блоками
Випадковий швидкий бій
Боïв у кожному блоці
{{total}} ({{ai}} проти ШІ + дуель)
Усього 10 боїв: кожен гравець перемагає ШІ у 9 боях, а потім б’ється з іншим гравцем у дуелі.
Кількість блоків
Після кожного блоку ви граєте спільну дуель. Перемога в дуелі дає 1 очко; бої з ШІ очок не дають.
Спіймані покемони для підкріплення
Немає
Перед дуеллю кожен може замінити вибрану кількість покемонів команди покемонами зі свого профілю. Вони залишаються у сховищі.
Рівні покемонів
Автоматичне вирівнювання
Зберегти поточні рівні
Автоматичний режим вирівнює дуель за менш досвідченим гравцем, округлюючи рівень униз до 5. Збережені рівні не змінюються.
Дозволити дуель за очко у Вільній парі
Команди для дуелі
Повністю випадкові покемони, збалансовані рівні
Збалансовані команди вибере комп’ютер
Кожен гравець отримує шість різних покемонів. Обидві команди мають однаковий рівень.
Комп’ютер створює дві команди по шість покемонів зі схожою базовою силою та вирівнює їхні рівні.
Рівень
Випадковий рівень, однаковий для всіх
Вибрати рівень
У випадковому режимі всі 12 покемонів отримують один випадковий рівень від 1 до 100.
Вибраний рівень (1–100)
Продовжити матч
Готово · почати
Прогрес окремий: у кожного гравця свої збереження, налаштування, профілі й сенсорне керування. Пауза в грі спільна.
Тримайте телефон вертикально, щоб грати удвох.
Перемоги над ШІ: {{pveBattlesWon}} · найкраща хвиля: {{bestRunWave}} · дуелі П/П/Н: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · матчі: {{matchesWon}}/{{matchesPlayed}} · Покедекс: побачено {{seen}}, спіймано {{caught}}
Сховище покемонів: {{count}}
Немає спійманих покемонів
Ці копії можна вибрати замість учасників команди для дуелі згідно з правилами матчу.
Вибраний профіль:
Завершіть або поновіть поточний матч, перш ніж змінювати профіль.
Профіль збережено.
Введіть ім’я профілю.
Профіль створено й завантажено. Прогрес починається з нуля.
Цей профіль використовує інший гравець, тому зараз його не можна видалити.
Підтвердження 1 з 2: видалити {{avatar}} {{name}} і всі його збереження, спійманих покемонів та статистику?
Підтвердження 2 з 2: останній крок. {{avatar}} {{name}} і весь його прогрес буде видалено назавжди.
Підтвердити (1/2)
Видалити назавжди
Активний профіль змінився. Почніть видалення знову для вибраного профілю.
Не вдалося видалити профіль; дані не змінено.
Профіль видалено разом зі збереженнями та покемонами. Перевірте, який профіль тепер завантажено.
Видалення скасовано; профіль збережено.
Профіль завантажено з прогресом і спійманими покемонами.
Матч блоками: кожен гравець б’ється з ШІ у своєму забігу. Коли обидва виграють потрібну кількість боїв, вони зустрічаються в дуелі.
Вільна пара: кожен проходить свій забіг проти ШІ у власному темпі. Увімкніть параметр нижче, щоб зіграти дуель за 1 очко.
Швидкий бій: комп’ютер відразу готує дві команди по шість покемонів, після чого починається дуель. Профілі й прогрес соло не змінюються.
Комп’ютер вибирає дві збалансовані команди
Випадкові покемони, однаковий рівень в обох команд
спільний випадковий рівень
рівень {{level}} для всіх 12 покемонів
Випадковий швидкий бій: {{teams}} ({{level}}). Боïв з ШІ немає; матч починається з дуелі за 1 очко.
Вільна пара: кожен просувається у своєму забігу проти ШІ. Натисніть «Дуель», щоб зіграти за 1 очко.
Вільна пара: кожен просувається у своєму забігу проти ШІ. Дуелі за очки вимкнено.
У кожному блоці для кожного гравця є {{ai}} боїв із ШІ та одна спільна дуель. За {{blocks}} блоків: {{pve}} боїв із ШІ на гравця та {{duels}} дуелей. Перемога в дуелі дає 1 очко; бої з ШІ очок не дають.
Довгий матч: може знадобитися кілька сеансів.
Випадково вибираються дванадцять різних покемонів. Обидві команди матимуть однаковий випадковий рівень від 1 до 100.
Комп’ютер створює дві команди по шість покемонів зі схожою базовою силою та вирівнює їхні рівні.
Готово ✓ — очікування гравця 2
Готово ✓ — очікування гравця 1
Ви готові · очікування гравця 1.
Очікування налаштувань гравця 1.`,
  pl: `PokéRogue 2Players
GRACZ 2
Profil gracza {{player}}
Wybierz profil
Wybrany profil: {{label}}
Wybrany profil
Nazwa
Ikona
Gamepad
Gwiazdka
Ogień
Trawa
Woda
Błyskawica
Kolor
Fioletowy
Czerwony
Niebieski
Zielony
Żółty
Zapisz
Utwórz profil o tej nazwie
Każdy profil przechowuje swoje podejścia, złapane Pokémony i ustawienia. Po dwóch potwierdzeniach usunięte zostaną również te dane.
Usuń ten profil
Potwierdź usunięcie
Anuluj
Gotowe
Oczekiwanie na ustawienia gracza 1.
2 GRACZY
GRACZ 1 · USTAWIENIA
Tryb gry
Wolny duet
Mecz blokowy
Losowa szybka walka
Walki w bloku
{{total}} ({{ai}} z SI + pojedynek)
Przy 10 walkach łącznie każdy wygrywa 9 walk z SI, zanim zmierzy się z drugim graczem w pojedynku.
Liczba bloków
Po każdym bloku rozegracie wspólny pojedynek. Wygrany pojedynek daje 1 punkt; walki z SI nie dają punktów.
Złapane Pokémony jako wsparcie
Brak
Przed pojedynkiem każdy może zastąpić wybraną liczbę Pokémonów z drużyny okazami złapanymi na swoim profilu. Pozostaną one w schowku.
Poziomy Pokémonów
Automatyczne wyrównanie
Zachowaj obecne poziomy
Tryb automatyczny wyrównuje pojedynek do mniej zaawansowanego gracza, zaokrąglając poziom w dół do 5. Zapisane poziomy pozostają bez zmian.
Zezwól na pojedynek o punkt w Wolnym duecie
Drużyny do pojedynku
Całkowicie losowe Pokémony, wyrównane poziomy
Zrównoważone drużyny wybierane przez komputer
Każdy gracz otrzymuje sześć różnych Pokémonów. Obie drużyny mają ten sam poziom.
Komputer tworzy dwie sześcioosobowe drużyny o podobnej sile bazowej i wyrównuje ich poziomy.
Poziom
Losowy poziom, taki sam dla wszystkich
Wybierz poziom
W trybie losowym wszystkie 12 Pokémonów ma ten sam poziom wylosowany z zakresu 1–100.
Wybrany poziom (1–100)
Wznów mecz
Gotowy · start
Osobny postęp: każdy gracz ma własne zapisy, ustawienia, profile i sterowanie dotykowe. Pauza w grze jest wspólna.
Trzymaj telefon pionowo, aby grać we dwoje.
Wygrane z SI: {{pveBattlesWon}} · najlepsza fala: {{bestRunWave}} · pojedynki W/P/R: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · mecze: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} widzianych, {{caught}} złapanych
Schowek złapanych Pokémonów: {{count}}
Brak złapanych Pokémonów
Te kopie mogą zastąpić członków drużyny w pojedynku, zgodnie z zasadami meczu.
Wybrany profil:
Zakończ lub wznów bieżący mecz, zanim zmienisz profil.
Profil zapisany.
Wpisz nazwę profilu.
Profil utworzony i wczytany. Postęp zaczyna się od zera.
Drugi gracz używa tego profilu, więc nie można go teraz usunąć.
Potwierdzenie 1 z 2: usunąć {{avatar}} {{name}} oraz wszystkie jego zapisy, złapane Pokémony i statystyki?
Potwierdzenie 2 z 2: ostatni krok. {{avatar}} {{name}} i cały postęp zostaną trwale usunięte.
Potwierdź (1/2)
Usuń na stałe
Aktywny profil się zmienił. Rozpocznij usuwanie ponownie dla wybranego profilu.
Nie udało się usunąć profilu; nie wprowadzono zmian.
Profil usunięto wraz z zapisami i złapanymi Pokémonami. Sprawdź, który profil jest teraz wczytany.
Usuwanie anulowano; profil został zachowany.
Profil wczytany wraz z postępem i złapanymi Pokémonami.
Mecz blokowy: każdy walczy z SI w osobnym podejściu. Gdy obaj wygrają wymagane walki, rozegrają pojedynek.
Wolny duet: każdy gra we własnym tempie w osobnym podejściu przeciwko SI. Włącz opcję poniżej, aby rozegrać pojedynek o 1 punkt.
Szybka walka: komputer od razu przygotowuje dwie drużyny po sześć Pokémonów, a potem zaczyna się pojedynek. Profile i postęp solo nie ulegają zmianie.
Komputer wybiera dwie zrównoważone drużyny
Losowe Pokémony, ten sam poziom obu drużyn
wspólny losowy poziom
poziom {{level}} dla wszystkich 12 Pokémonów
Losowa szybka walka: {{teams}} ({{level}}). Nie ma walk z SI; mecz zaczyna się pojedynkiem o 1 punkt.
Wolny duet: każdy robi postępy we własnym podejściu przeciwko SI. Wybierz Pojedynek, aby zagrać o 1 punkt.
Wolny duet: każdy robi postępy we własnym podejściu przeciwko SI. Pojedynki o punkty są wyłączone.
Każdy blok obejmuje {{ai}} walk z SI na gracza i jeden wspólny pojedynek. W {{blocks}} blokach: {{pve}} walk z SI na gracza i {{duels}} pojedynków. Zwycięstwo w pojedynku daje 1 punkt; walki z SI nie dają punktów.
Długi mecz: może wymagać kilku sesji.
Losowanych jest dwanaście różnych Pokémonów. Obie drużyny mają ten sam losowy poziom od 1 do 100.
Komputer tworzy dwie sześcioosobowe drużyny o podobnej sile bazowej i wyrównuje ich poziomy.
Gotowy ✓ — oczekiwanie na gracza 2
Gotowy ✓ — oczekiwanie na gracza 1
Jesteś gotowy · oczekiwanie na gracza 1.
Oczekiwanie na ustawienia gracza 1.`,
  id: `PokéRogue 2Players
PEMAIN 2
Profil pemain {{player}}
Pilih profil
Profil terpilih: {{label}}
Profil terpilih
Nama
Ikon
Gamepad
Bintang
Api
Rumput
Air
Petir
Warna
Ungu
Merah
Biru
Hijau
Kuning
Simpan
Buat profil dengan nama ini
Setiap profil menyimpan permainan, tangkapan, dan pengaturannya sendiri. Menghapus profil juga menghapus data tersebut setelah dua konfirmasi.
Hapus profil ini
Konfirmasi penghapusan
Batal
Siap
Menunggu pengaturan P1.
2 PEMAIN
PEMAIN 1 · PENGATURAN
Mode permainan
Duo Bebas
Pertandingan Blok
Pertarungan Cepat Acak
Pertarungan per blok
{{total}} ({{ai}} melawan AI + duel)
Dari total 10 pertarungan, setiap pemain menang 9 kali melawan AI sebelum berduel dengan pemain lain.
Jumlah blok
Setelah setiap blok, kalian bertanding dalam duel bersama. Setiap kemenangan duel bernilai 1 poin; pertarungan melawan AI tidak memberi poin.
Pokémon tangkapan sebagai bantuan
Tidak ada
Sebelum duel, setiap pemain dapat mengganti hingga jumlah yang dipilih dengan Pokémon tangkapan dari profilnya. Tangkapan tetap tersimpan.
Level Pokémon
Penyeimbangan otomatis
Pertahankan level saat ini
Mode otomatis menyesuaikan duel dengan pemain yang progresnya lebih rendah, dibulatkan ke bawah ke kelipatan 5. Level tersimpan tidak berubah.
Izinkan duel berpoin di Duo Bebas
Tim duel
Pokémon sepenuhnya acak, level seimbang
Tim seimbang dipilih komputer
Setiap pemain mendapat enam Pokémon berbeda. Kedua tim memiliki level yang sama.
Komputer membuat dua tim berisi enam Pokémon dengan kekuatan dasar serupa, lalu menyamakan levelnya.
Level
Level acak yang sama untuk semua
Pilih level
Dalam mode acak, semua 12 Pokémon mendapat level acak yang sama dari 1 sampai 100.
Level pilihan (1–100)
Lanjutkan pertandingan
Siap · mulai
Progres terpisah: setiap pemain memiliki simpanan, pengaturan, profil, dan kontrol sentuh masing-masing. Jeda dalam permainan berlaku bersama.
Pegang ponsel secara tegak untuk bermain berdua.
Kemenangan AI: {{pveBattlesWon}} · gelombang terbaik: {{bestRunWave}} · duel M/K/S: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · pertandingan: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} terlihat, {{caught}} tertangkap
Bank tangkapan: {{count}} Pokémon
Belum ada tangkapan
Salinan ini dapat menggantikan anggota tim untuk duel, sesuai aturan pertandingan.
Profil terpilih:
Selesaikan atau lanjutkan pertandingan saat ini sebelum mengganti profil.
Profil disimpan.
Masukkan nama untuk profil ini.
Profil dibuat dan dimuat. Progresnya dimulai dari nol.
Profil ini sedang digunakan pemain lain, jadi belum dapat dihapus.
Konfirmasi 1 dari 2: hapus {{avatar}} {{name}} beserta semua simpanan, tangkapan, dan statistiknya?
Konfirmasi 2 dari 2: langkah terakhir. {{avatar}} {{name}} dan seluruh progresnya akan dihapus permanen.
Konfirmasi (1/2)
Hapus permanen
Profil aktif berubah. Mulai ulang penghapusan dari profil yang dipilih.
Penghapusan gagal; profil tidak diubah.
Profil dihapus bersama simpanan dan tangkapannya. Periksa profil yang sekarang dimuat.
Penghapusan dibatalkan; profil tetap ada.
Profil dimuat bersama progres dan tangkapannya.
Pertandingan Blok: setiap pemain melawan AI dalam permainan masing-masing. Setelah keduanya menang dalam jumlah pertarungan yang ditentukan, mereka berduel.
Duo Bebas: setiap pemain menjalani permainan AI sendiri dengan kecepatan masing-masing. Aktifkan opsi di bawah untuk memulai duel bernilai 1 poin.
Pertarungan Cepat: komputer langsung menyiapkan dua tim berisi enam Pokémon, lalu duel dimulai. Profil dan progres solo tidak berubah.
Komputer memilih dua tim yang seimbang
Pokémon acak dengan level yang sama untuk kedua tim
level acak bersama
level {{level}} untuk semua 12 Pokémon
Pertarungan Cepat Acak: {{teams}} ({{level}}). Tidak ada pertarungan AI; pertandingan dimulai dengan duel bernilai 1 poin.
Duo Bebas: setiap pemain maju dalam permainan AI masing-masing. Gunakan Duel untuk bertanding demi 1 poin.
Duo Bebas: setiap pemain maju dalam permainan AI masing-masing. Duel berpoin dinonaktifkan.
Setiap blok berisi {{ai}} pertarungan AI per pemain dan satu duel bersama. Dalam {{blocks}} blok: {{pve}} pertarungan AI per pemain dan {{duels}} duel. Kemenangan duel bernilai 1 poin; pertarungan AI tidak memberi poin.
Pertandingan panjang: mungkin perlu dimainkan dalam beberapa sesi.
Dua belas Pokémon berbeda dipilih secara acak. Kedua tim mendapat level acak yang sama dari 1 sampai 100.
Komputer membuat dua tim berisi enam Pokémon dengan kekuatan dasar serupa, lalu menyamakan levelnya.
Siap ✓ — menunggu P2
Siap ✓ — menunggu P1
Kamu siap · menunggu P1.
Menunggu pengaturan P1.`,
  vi: `PokéRogue 2Players
NGƯỜI CHƠI 2
Hồ sơ người chơi {{player}}
Chọn hồ sơ
Hồ sơ đã chọn: {{label}}
Hồ sơ đã chọn
Tên
Biểu tượng
Tay cầm
Ngôi sao
Lửa
Cỏ
Nước
Điện
Màu sắc
Tím
Đỏ
Xanh dương
Xanh lá
Vàng
Lưu
Tạo hồ sơ với tên này
Mỗi hồ sơ lưu riêng lượt chơi, Pokémon bắt được và cài đặt. Xóa hồ sơ sẽ xóa dữ liệu sau hai lần xác nhận.
Xóa hồ sơ này
Xác nhận xóa
Hủy
Sẵn sàng
Đang chờ cài đặt của người chơi 1.
2 NGƯỜI CHƠI
NGƯỜI CHƠI 1 · CÀI ĐẶT
Chế độ chơi
Chơi đôi tự do
Trận đấu theo lượt
Trận nhanh ngẫu nhiên
Số trận trong mỗi lượt
{{total}} ({{ai}} trận với máy + đấu đôi)
Với tổng cộng 10 trận, mỗi người thắng 9 trận với máy trước khi đấu với người chơi còn lại.
Số lượt
Sau mỗi lượt, hai bạn đấu một trận. Mỗi trận thắng được 1 điểm; trận với máy không tính điểm.
Pokémon đã bắt làm hỗ trợ
Không có
Trước trận đấu, mỗi người có thể thay tối đa số Pokémon đã chọn bằng Pokémon bắt được trong hồ sơ. Pokémon vẫn được lưu lại.
Cấp độ Pokémon
Cân bằng tự động
Giữ cấp độ hiện tại
Chế độ tự động cân bằng theo người chơi có cấp độ thấp hơn, làm tròn xuống bội số của 5. Cấp độ đã lưu không đổi.
Cho phép đấu tính điểm trong Chơi đôi tự do
Đội hình đấu
Pokémon hoàn toàn ngẫu nhiên, cấp độ cân bằng
Máy chọn đội hình cân bằng
Mỗi người nhận sáu Pokémon khác nhau. Hai đội có cùng cấp độ.
Máy tạo hai đội sáu Pokémon có sức mạnh cơ bản tương đương rồi cân bằng cấp độ.
Cấp độ
Cấp độ ngẫu nhiên, giống nhau cho tất cả
Chọn cấp độ
Ở chế độ ngẫu nhiên, cả 12 Pokémon có cùng cấp độ được chọn ngẫu nhiên từ 1 đến 100.
Cấp độ đã chọn (1–100)
Tiếp tục trận đấu
Sẵn sàng · bắt đầu
Tiến trình riêng: mỗi người có dữ liệu lưu, cài đặt, hồ sơ và nút cảm ứng riêng. Tạm dừng trong trận đấu áp dụng cho cả hai.
Giữ điện thoại theo chiều dọc để chơi hai người.
Trận thắng trước máy: {{pveBattlesWon}} · đợt cao nhất: {{bestRunWave}} · đấu đôi thắng/thua/hòa: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · trận đấu: {{matchesWon}}/{{matchesPlayed}} · Pokédex: đã thấy {{seen}}, đã bắt {{caught}}
Kho Pokémon bắt được: {{count}}
Chưa bắt được Pokémon nào
Các bản sao này có thể thay thành viên đội hình trong trận đấu theo luật chơi.
Hồ sơ đã chọn:
Hãy hoàn thành hoặc tiếp tục trận hiện tại trước khi đổi hồ sơ.
Đã lưu hồ sơ.
Nhập tên cho hồ sơ này.
Đã tạo và tải hồ sơ. Tiến trình bắt đầu từ đầu.
Người chơi còn lại đang dùng hồ sơ này nên hiện không thể xóa.
Xác nhận 1/2: xóa {{avatar}} {{name}} cùng toàn bộ dữ liệu lưu, Pokémon bắt được và thống kê?
Xác nhận 2/2: bước cuối. {{avatar}} {{name}} và toàn bộ tiến trình sẽ bị xóa vĩnh viễn.
Xác nhận (1/2)
Xóa vĩnh viễn
Hồ sơ đang hoạt động đã thay đổi. Hãy bắt đầu lại thao tác xóa với hồ sơ đã chọn.
Không thể xóa hồ sơ; dữ liệu không thay đổi.
Đã xóa hồ sơ cùng dữ liệu lưu và Pokémon bắt được. Hãy kiểm tra hồ sơ hiện đang tải.
Đã hủy xóa; hồ sơ vẫn được giữ lại.
Đã tải hồ sơ cùng tiến trình và Pokémon bắt được.
Trận đấu theo lượt: mỗi người đấu với máy trong lượt chơi riêng. Sau khi cả hai thắng đủ số trận, hai người sẽ đấu với nhau.
Chơi đôi tự do: mỗi người tự chơi với máy theo nhịp độ riêng. Bật tùy chọn bên dưới để đấu lấy 1 điểm.
Trận nhanh: máy lập tức chuẩn bị hai đội sáu Pokémon rồi bắt đầu đấu. Hồ sơ và tiến trình chơi đơn không thay đổi.
Máy chọn hai đội hình cân bằng
Pokémon ngẫu nhiên, hai đội có cùng cấp độ
cấp độ ngẫu nhiên chung
cấp độ {{level}} cho cả 12 Pokémon
Trận nhanh ngẫu nhiên: {{teams}} ({{level}}). Không có trận với máy; trận đấu bắt đầu bằng cuộc đấu lấy 1 điểm.
Chơi đôi tự do: mỗi người tiếp tục lượt chơi với máy theo nhịp độ riêng. Chọn Đấu để tranh 1 điểm.
Chơi đôi tự do: mỗi người tiếp tục lượt chơi với máy theo nhịp độ riêng. Đã tắt đấu tính điểm.
Mỗi lượt gồm {{ai}} trận với máy cho mỗi người và một trận đấu chung. Trong {{blocks}} lượt: {{pve}} trận với máy mỗi người và {{duels}} trận đấu. Thắng trận đấu được 1 điểm; trận với máy không tính điểm.
Trận dài: có thể cần chơi trong nhiều phiên.
Máy chọn ngẫu nhiên mười hai Pokémon khác nhau. Hai đội có cùng cấp độ ngẫu nhiên từ 1 đến 100.
Máy tạo hai đội sáu Pokémon có sức mạnh cơ bản tương đương rồi cân bằng cấp độ.
Sẵn sàng ✓ — đang chờ người chơi 2
Sẵn sàng ✓ — đang chờ người chơi 1
Bạn đã sẵn sàng · đang chờ người chơi 1.
Đang chờ cài đặt của người chơi 1.`,
  da: `PokéRogue 2Players
SPILLER 2
Spiller {{player}}s profil
Vælg en profil
Valgt profil: {{label}}
Valgt profil
Navn
Ikon
Gamepad
Stjerne
Ild
Græs
Vand
Lyn
Farve
Lilla
Rød
Blå
Grøn
Gul
Gem
Opret en profil med dette navn
Hver profil gemmer sine løb, fangster og indstillinger. Når profilen slettes efter to bekræftelser, slettes disse data også.
Slet denne profil
Bekræft sletning
Annuller
Klar
Venter på spiller 1's indstillinger.
2 SPILLERE
SPILLER 1 · OPSÆTNING
Spiltilstand
Frit duo
Blokmatch
Tilfældig hurtigkamp
Kampe i hver blok
{{total}} ({{ai}} mod AI + duel)
Ved 10 kampe i alt vinder hver spiller 9 kampe mod AI, før de møder hinanden i en duel.
Antal blokke
Efter hver blok spiller I en duel sammen. Hver duel giver 1 point; AI-kampe giver ingen point.
Fangede Pokémon som forstærkning
Ingen
Før en duel kan hver spiller erstatte op til det valgte antal Pokémon med fangster fra sin profil. Fangsterne bliver gemt.
Pokémon-niveauer
Automatisk balancering
Behold nuværende niveauer
Automatisk tilstand matcher den mindst avancerede spiller og runder ned til nærmeste 5. Gemte niveauer ændres ikke.
Tillad duel om point i Frit duo
Duelhold
Helt tilfældige Pokémon, balancerede niveauer
Balancerede hold valgt af computeren
Hver spiller får seks forskellige Pokémon. Begge hold har samme niveau.
Computeren laver to hold på seks med lignende grundstyrke og udligner deres niveauer.
Niveau
Tilfældigt niveau, ens for alle
Vælg niveau
I tilfældig tilstand får alle 12 Pokémon samme tilfældige niveau fra 1 til 100.
Valgt niveau (1–100)
Fortsæt match
Klar · start
Separat fremgang: hver spiller har egne gemte spil, indstillinger, profiler og touchkontroller. Pause under spillet er fælles.
Hold telefonen lodret for at spille to sammen.
AI-sejre: {{pveBattlesWon}} · bedste bølge: {{bestRunWave}} · dueller V/T/U: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · kampe: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} set, {{caught}} fanget
Fangstbank: {{count}} Pokémon
Ingen fangster
Disse kopier kan erstatte holdmedlemmer i en duel efter matchens regler.
Valgt profil:
Afslut eller genoptag det igangværende match, før du skifter profil.
Profil gemt.
Indtast et navn til profilen.
Profil oprettet og indlæst. Fremgangen starter fra nul.
Den anden spiller bruger denne profil, så den kan ikke slettes nu.
Bekræftelse 1 af 2: Slet {{avatar}} {{name}} og alle gemte spil, fangster og statistikker?
Bekræftelse 2 af 2: sidste trin. {{avatar}} {{name}} og al fremgang slettes permanent.
Bekræft (1/2)
Slet permanent
Den aktive profil er ændret. Start sletningen igen fra den valgte profil.
Sletning mislykkedes; profilen blev ikke ændret.
Profilen blev slettet med gemte spil og fangster. Tjek, hvilken profil der nu er indlæst.
Sletning annulleret; profilen bevares.
Profil indlæst med fremgang og fangster.
Blokmatch: hver spiller kæmper mod AI i sit eget spil. Når begge har vundet de nødvendige kampe, mødes de i en duel.
Frit duo: hver spiller spiller sit eget AI-spil i sit eget tempo. Slå indstillingen nedenfor til for at spille om 1 point.
Hurtigkamp: computeren gør straks to hold på seks Pokémon klar, og duellen begynder. Solo-profiler og fremgang ændres ikke.
Computeren vælger to balancerede hold
Tilfældige Pokémon med samme niveau på begge hold
fælles tilfældigt niveau
niveau {{level}} for alle 12 Pokémon
Tilfældig hurtigkamp: {{teams}} ({{level}}). Ingen AI-kampe; matchen starter med en duel om 1 point.
Frit duo: hver spiller fortsætter sit AI-spil i eget tempo. Brug Duel til at spille om 1 point.
Frit duo: hver spiller fortsætter sit AI-spil i eget tempo. Dueller om point er slået fra.
Hver blok har {{ai}} AI-kampe pr. spiller og én fælles duel. I {{blocks}} blokke: {{pve}} AI-kampe pr. spiller og {{duels}} dueller. En duel-sejr giver 1 point; AI-kampe giver ingen point.
Langt match: det kan kræve flere spilsessioner.
Tolv forskellige Pokémon vælges tilfældigt. Begge hold får samme tilfældige niveau fra 1 til 100.
Computeren laver to hold på seks med lignende grundstyrke og udligner deres niveauer.
Klar ✓ — venter på spiller 2
Klar ✓ — venter på spiller 1
Du er klar · venter på spiller 1.
Venter på spiller 1's indstillinger.`,
  sv: `PokéRogue 2Players
SPELARE 2
Spelare {{player}}s profil
Välj en profil
Vald profil: {{label}}
Vald profil
Namn
Ikon
Handkontroll
Stjärna
Eld
Gräs
Vatten
Blixt
Färg
Lila
Röd
Blå
Grön
Gul
Spara
Skapa en profil med det här namnet
Varje profil sparar sina rundor, fångster och inställningar. När profilen raderas efter två bekräftelser tas även dessa data bort.
Ta bort den här profilen
Bekräfta borttagning
Avbryt
Klar
Väntar på spelare 1:s inställningar.
2 SPELARE
SPELARE 1 · INSTÄLLNINGAR
Spelläge
Fritt duo
Blockmatch
Slumpad snabbmatch
Strider i varje block
{{total}} ({{ai}} mot AI + duell)
Av totalt 10 strider vinner varje spelare 9 mot AI innan de möter den andra spelaren i en duell.
Antal block
Efter varje block spelar ni en gemensam duell. Varje vunnen duell ger 1 poäng; AI-strider ger inga poäng.
Fångade Pokémon som förstärkning
Inga
Före en duell kan varje spelare ersätta upp till det valda antalet Pokémon med fångster från sin profil. Fångsterna finns kvar.
Pokémon-nivåer
Automatisk balansering
Behåll nuvarande nivåer
Automatiskt läge anpassar duellen till den minst avancerade spelaren och avrundar nedåt till närmaste 5. Sparade nivåer ändras inte.
Tillåt poängduell i Fritt duo
Duellag
Helt slumpade Pokémon, balanserade nivåer
Balanserade lag valda av datorn
Varje spelare får sex olika Pokémon. Båda lagen har samma nivå.
Datorn skapar två lag med sex Pokémon med liknande grundstyrka och jämnar ut deras nivåer.
Nivå
Slumpad nivå, samma för alla
Välj nivå
I slumpat läge får alla 12 Pokémon samma slumpade nivå mellan 1 och 100.
Vald nivå (1–100)
Återuppta match
Klar · starta
Separata framsteg: varje spelare har egna sparfiler, inställningar, profiler och pekskärmskontroller. Pausen under spelet är gemensam.
Håll telefonen stående för att spela två tillsammans.
AI-segrar: {{pveBattlesWon}} · bästa våg: {{bestRunWave}} · dueller V/F/O: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · matcher: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} sedda, {{caught}} fångade
Fångstbank: {{count}} Pokémon
Inga fångster
Dessa kopior kan ersätta lagmedlemmar i en duell enligt matchens regler.
Vald profil:
Avsluta eller återuppta den pågående matchen innan du byter profil.
Profilen har sparats.
Ange ett namn för profilen.
Profilen har skapats och lästs in. Framstegen börjar från noll.
Den andra spelaren använder profilen, så den kan inte tas bort just nu.
Bekräftelse 1 av 2: ta bort {{avatar}} {{name}} och alla sparfiler, fångster och all statistik?
Bekräftelse 2 av 2: sista steget. {{avatar}} {{name}} och alla framsteg tas bort permanent.
Bekräfta (1/2)
Ta bort permanent
Den aktiva profilen har ändrats. Börja om borttagningen från den valda profilen.
Borttagningen misslyckades; profilen ändrades inte.
Profilen togs bort tillsammans med sparfiler och fångster. Kontrollera vilken profil som är inläst nu.
Borttagningen avbröts; profilen finns kvar.
Profilen har lästs in med framsteg och fångster.
Blockmatch: varje spelare möter AI i sin egen runda. När båda har vunnit det antal strider som krävs möts de i en duell.
Fritt duo: varje spelare spelar sin egen AI-runda i sin egen takt. Aktivera alternativet nedan för en duell om 1 poäng.
Snabbmatch: datorn skapar direkt två lag med sex Pokémon och sedan börjar duellen. Soloprofiler och framsteg påverkas inte.
Datorn väljer två balanserade lag
Slumpade Pokémon med samma nivå i båda lagen
gemensam slumpad nivå
nivå {{level}} för alla 12 Pokémon
Slumpad snabbmatch: {{teams}} ({{level}}). Inga AI-strider; matchen börjar med en duell om 1 poäng.
Fritt duo: varje spelare fortsätter sin AI-runda i egen takt. Använd Duell för att spela om 1 poäng.
Fritt duo: varje spelare fortsätter sin AI-runda i egen takt. Poängdueller är avstängda.
Varje block innehåller {{ai}} AI-strider per spelare och en gemensam duell. I {{blocks}} block: {{pve}} AI-strider per spelare och {{duels}} dueller. En duellseger ger 1 poäng; AI-strider ger inga poäng.
Lång match: det kan behövas flera spelsessioner.
Tolv olika Pokémon väljs slumpmässigt. Båda lagen får samma slumpade nivå mellan 1 och 100.
Datorn skapar två lag med sex Pokémon med liknande grundstyrka och jämnar ut deras nivåer.
Klar ✓ — väntar på spelare 2
Klar ✓ — väntar på spelare 1
Du är klar · väntar på spelare 1.
Väntar på spelare 1:s inställningar.`,
  tl: `PokéRogue 2Players
MANLALARO 2
Profile ng manlalaro {{player}}
Pumili ng profile
Napiling profile: {{label}}
Napiling profile
Pangalan
Icon
Gamepad
Bituin
Apoy
Damo
Tubig
Kidlat
Kulay
Lila
Pula
Bughaw
Berde
Dilaw
I-save
Gumawa ng profile gamit ang pangalang ito
Naka-save sa bawat profile ang mga laro, nahuling Pokémon, at setting nito. Buburahin din ang mga datos kapag kinumpirma ang pagtanggal nang dalawang beses.
Burahin ang profile na ito
Kumpirmahin ang pagbura
Kanselahin
Handa
Naghihintay sa setting ng Manlalaro 1.
2 MANLALARO
MANLALARO 1 · MGA SETTING
Mode ng laro
Libreng Duo
Labanan kada Block
Random na Mabilisang Laban
Mga laban sa bawat block
{{total}} ({{ai}} laban sa AI + duel)
Sa kabuuang 10 laban, mananalo ang bawat manlalaro ng 9 laban sa AI bago makipag-duel sa isa't isa.
Bilang ng mga block
Pagkatapos ng bawat block, maglalaro kayo ng duel. Bawat panalo sa duel ay may 1 puntos; walang puntos ang mga laban sa AI.
Mga nahuling Pokémon bilang reserba
Wala
Bago ang duel, maaaring palitan ng bawat manlalaro ang piniling bilang ng Pokémon sa team gamit ang mga nahuli sa profile. Mananatili ang mga nahuli sa profile.
Mga level ng Pokémon
Awtomatikong balanse
Panatilihin ang kasalukuyang level
Itinatapat ng awtomatikong mode ang duel sa mas mababang level ng manlalaro, pababa sa pinakamalapit na multiple ng 5. Hindi nagbabago ang mga naka-save na level.
Payagan ang duel na may puntos sa Libreng Duo
Mga team para sa duel
Ganap na random na Pokémon, balanseng level
Balanseng team na pinili ng computer
Makakakuha ang bawat manlalaro ng anim na magkakaibang Pokémon. Magkapareho ang level ng dalawang team.
Gumagawa ang computer ng dalawang team na tig-aanim na Pokémon na magkalapit ang lakas, saka pinapantay ang level.
Level
Random na level, pareho para sa lahat
Pumili ng level
Sa random mode, pare-pareho ang random na level ng 12 Pokémon mula 1 hanggang 100.
Piniling level (1–100)
Ipagpatuloy ang laban
Handa · simulan
Magkahiwalay ang progreso: may sariling save, setting, profile, at touch control ang bawat manlalaro. Pareho ang pause habang naglalaro.
Hawakan nang patayo ang telepono para maglaro nang dalawahan.
Panalo laban sa AI: {{pveBattlesWon}} · pinakamataas na wave: {{bestRunWave}} · duel P/T/G: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · mga laban: {{matchesWon}}/{{matchesPlayed}} · Pokédex: {{seen}} nakita, {{caught}} nahuli
Bangko ng nahuli: {{count}} Pokémon
Walang nahuli
Maaaring ipalit ang mga kopyang ito sa miyembro ng team para sa duel, ayon sa mga patakaran ng laban.
Napiling profile:
Tapusin o ipagpatuloy muna ang kasalukuyang laban bago magpalit ng profile.
Na-save ang profile.
Maglagay ng pangalan para sa profile na ito.
Nagawa at na-load ang profile. Magsisimula sa zero ang progreso.
Ginagamit ng isa pang manlalaro ang profile na ito kaya hindi ito mabubura ngayon.
Kumpirmasyon 1 sa 2: burahin si {{avatar}} {{name}} pati ang lahat ng save, nahuli, at istatistika?
Kumpirmasyon 2 sa 2: huling hakbang. Permanenteng mabubura si {{avatar}} {{name}} at lahat ng progreso.
Kumpirmahin (1/2)
Burahin nang tuluyan
Nagbago ang aktibong profile. Simulan ulit ang pagbura sa napiling profile.
Hindi nabura ang profile; walang binago.
Nabura ang profile kasama ang mga save at nahuli. Tingnan kung aling profile ang naka-load ngayon.
Kinansela ang pagbura; nanatili ang profile.
Na-load ang profile kasama ang progreso at mga nahuli.
Labanan kada Block: nakikipaglaban ang bawat manlalaro sa AI sa sarili nitong laro. Kapag nanalo na ang dalawa sa mga kailangang laban, magdu-duel sila.
Libreng Duo: naglalaro ang bawat isa sa AI sa sarili nilang takbo. I-on ang opsyon sa ibaba para magsimula ng duel na may 1 puntos.
Mabilisang Laban: agad na naghahanda ang computer ng dalawang team na may tig-aanim na Pokémon bago magsimula ang duel. Hindi maaapektuhan ang solo profile at progreso.
Pumipili ang computer ng dalawang balanseng team
Random na Pokémon na pareho ang level ng dalawang team
parehong random na level
level {{level}} para sa lahat ng 12 Pokémon
Random na Mabilisang Laban: {{teams}} ({{level}}). Walang laban sa AI; magsisimula ang laban sa duel na may 1 puntos.
Libreng Duo: nagpapatuloy ang bawat isa sa sariling laro laban sa AI. Piliin ang Duel para maglaro para sa 1 puntos.
Libreng Duo: nagpapatuloy ang bawat isa sa sariling laro laban sa AI. Naka-off ang mga duel na may puntos.
May {{ai}} laban sa AI bawat manlalaro at isang pinagsasaluhang duel sa bawat block. Sa {{blocks}} block: {{pve}} laban sa AI bawat manlalaro at {{duels}} duel. May 1 puntos sa panalo sa duel; walang puntos sa laban sa AI.
Mahabang laban: maaaring abutin ng ilang sesyon.
Random na pinipili ang labindalawang magkakaibang Pokémon. Pareho ang random na level ng dalawang team, mula 1 hanggang 100.
Gumagawa ang computer ng dalawang team na tig-aanim na Pokémon na magkalapit ang lakas, saka pinapantay ang level.
Handa ✓ — naghihintay sa Manlalaro 2
Handa ✓ — naghihintay sa Manlalaro 1
Handa ka na · naghihintay sa Manlalaro 1.
Naghihintay sa setting ng Manlalaro 1.`,
  hi: `PokéRogue 2Players
खिलाड़ी 2
खिलाड़ी {{player}} की प्रोफ़ाइल
प्रोफ़ाइल चुनें
चुनी गई प्रोफ़ाइल: {{label}}
चुनी गई प्रोफ़ाइल
नाम
आइकन
गेमपैड
तारा
आग
घास
पानी
बिजली
रंग
बैंगनी
लाल
नीला
हरा
पीला
सहेजें
इस नाम से प्रोफ़ाइल बनाएँ
हर प्रोफ़ाइल अपनी दौड़, पकड़े गए पोकेमॉन और सेटिंग सहेजती है। दो बार पुष्टि करने के बाद मिटाने से ये डेटा भी हट जाएगा।
यह प्रोफ़ाइल मिटाएँ
मिटाने की पुष्टि करें
रद्द करें
तैयार
खिलाड़ी 1 की सेटिंग का इंतज़ार है।
2 खिलाड़ी
खिलाड़ी 1 · सेटअप
गेम मोड
मुक्त जोड़ी
ब्लॉक मुकाबला
यादृच्छिक त्वरित मुकाबला
हर ब्लॉक में मुकाबले
{{total}} ({{ai}} कंप्यूटर के खिलाफ + द्वंद्व)
कुल 10 मुकाबलों में, हर खिलाड़ी दूसरे खिलाड़ी से द्वंद्व करने से पहले कंप्यूटर के खिलाफ 9 मुकाबले जीतता है।
ब्लॉक की संख्या
हर ब्लॉक के बाद आप दोनों एक द्वंद्व खेलेंगे। हर जीता द्वंद्व 1 अंक देता है; कंप्यूटर के खिलाफ मुकाबले अंक नहीं देते।
सहायता के लिए पकड़े गए पोकेमॉन
कोई नहीं
द्वंद्व से पहले हर खिलाड़ी चुनी गई संख्या तक पोकेमॉन को अपनी प्रोफ़ाइल के पकड़े गए पोकेमॉन से बदल सकता है। वे संग्रह में बने रहते हैं।
पोकेमॉन का स्तर
स्वचालित संतुलन
मौजूदा स्तर रखें
स्वचालित मोड कम प्रगति वाले खिलाड़ी के अनुसार द्वंद्व का स्तर तय करता है और उसे 5 के निकटतम निचले गुणक तक करता है। सहेजे गए स्तर नहीं बदलते।
मुक्त जोड़ी में अंकों वाला द्वंद्व चालू करें
द्वंद्व दल
पूरी तरह यादृच्छिक पोकेमॉन, संतुलित स्तर
कंप्यूटर द्वारा चुने गए संतुलित दल
हर खिलाड़ी को छह अलग पोकेमॉन मिलते हैं। दोनों दलों का स्तर समान होता है।
कंप्यूटर मिलती-जुलती आधार शक्ति वाले छह-छह पोकेमॉन के दो दल बनाकर उनके स्तर बराबर करता है।
स्तर
सबके लिए एक जैसा यादृच्छिक स्तर
स्तर चुनें
यादृच्छिक मोड में सभी 12 पोकेमॉन का स्तर 1 से 100 के बीच चुना जाता है और समान रहता है।
चुना गया स्तर (1–100)
मुकाबला जारी रखें
तैयार · शुरू करें
प्रगति अलग है: हर खिलाड़ी की अपनी सेव, सेटिंग, प्रोफ़ाइल और टच नियंत्रण हैं। खेल के दौरान विराम दोनों के लिए साझा है।
दो खिलाड़ियों के लिए फ़ोन को सीधा रखें।
कंप्यूटर के खिलाफ जीत: {{pveBattlesWon}} · सबसे अच्छी लहर: {{bestRunWave}} · द्वंद्व जीत/हार/बराबर: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · मुकाबले: {{matchesWon}}/{{matchesPlayed}} · पोकेडेक्स: {{seen}} देखे, {{caught}} पकड़े
पकड़े गए पोकेमॉन: {{count}}
कोई पोकेमॉन नहीं पकड़ा
मैच के नियमों के अनुसार इन प्रतियों को द्वंद्व में दल के सदस्यों की जगह चुना जा सकता है।
चुनी गई प्रोफ़ाइल:
प्रोफ़ाइल बदलने से पहले मौजूदा मुकाबला पूरा करें या फिर से शुरू करें।
प्रोफ़ाइल सहेजी गई।
इस प्रोफ़ाइल के लिए नाम लिखें।
प्रोफ़ाइल बनाई और लोड की गई। इसकी प्रगति शून्य से शुरू होगी।
दूसरा खिलाड़ी इस प्रोफ़ाइल का उपयोग कर रहा है, इसलिए इसे अभी नहीं मिटाया जा सकता।
पुष्टि 1/2: {{avatar}} {{name}} और इसकी सभी सेव, पकड़े गए पोकेमॉन और आँकड़े मिटाएँ?
पुष्टि 2/2: आख़िरी चरण। {{avatar}} {{name}} और इसकी पूरी प्रगति स्थायी रूप से मिट जाएगी।
पुष्टि करें (1/2)
स्थायी रूप से मिटाएँ
सक्रिय प्रोफ़ाइल बदल गई है। चुनी गई प्रोफ़ाइल से मिटाने की प्रक्रिया फिर शुरू करें।
प्रोफ़ाइल नहीं मिटाई गई; कोई बदलाव नहीं हुआ।
प्रोफ़ाइल इसकी सेव और पकड़े गए पोकेमॉन के साथ मिटा दी गई। जाँचें कि अब कौन-सी प्रोफ़ाइल लोड है।
मिटाना रद्द हुआ; प्रोफ़ाइल सुरक्षित है।
प्रोफ़ाइल प्रगति और पकड़े गए पोकेमॉन के साथ लोड हुई।
ब्लॉक मुकाबला: हर खिलाड़ी अपने खेल में कंप्यूटर से लड़ता है। दोनों के ज़रूरी मुकाबले जीतने पर वे द्वंद्व करते हैं।
मुक्त जोड़ी: हर खिलाड़ी अपनी गति से कंप्यूटर के खिलाफ खेलता है। 1 अंक के द्वंद्व के लिए नीचे वाला विकल्प चालू करें।
त्वरित मुकाबला: कंप्यूटर तुरंत छह-छह पोकेमॉन के दो दल बनाता है, फिर द्वंद्व शुरू होता है। एकल-खिलाड़ी प्रोफ़ाइल और प्रगति नहीं बदलती।
कंप्यूटर दो संतुलित दल चुनता है
यादृच्छिक पोकेमॉन, दोनों दलों का स्तर समान
एक साझा यादृच्छिक स्तर
सभी 12 पोकेमॉन के लिए स्तर {{level}}
यादृच्छिक त्वरित मुकाबला: {{teams}} ({{level}})। कंप्यूटर के खिलाफ मुकाबले नहीं होंगे; मैच 1 अंक के द्वंद्व से शुरू होगा।
मुक्त जोड़ी: हर खिलाड़ी अपनी गति से कंप्यूटर के खिलाफ खेलता है। 1 अंक के लिए द्वंद्व चुनें।
मुक्त जोड़ी: हर खिलाड़ी अपनी गति से कंप्यूटर के खिलाफ खेलता है। अंकों वाले द्वंद्व बंद हैं।
हर ब्लॉक में प्रत्येक खिलाड़ी के {{ai}} कंप्यूटर मुकाबले और एक साझा द्वंद्व है। {{blocks}} ब्लॉक में: हर खिलाड़ी के {{pve}} कंप्यूटर मुकाबले और {{duels}} द्वंद्व। द्वंद्व जीतने पर 1 अंक मिलता है; कंप्यूटर मुकाबलों पर अंक नहीं मिलते।
लंबा मैच: इसे कई सत्रों में खेलना पड़ सकता है।
बारह अलग पोकेमॉन यादृच्छिक चुने जाते हैं। दोनों दलों का स्तर 1 से 100 के बीच समान यादृच्छिक होगा।
कंप्यूटर मिलती-जुलती आधार शक्ति वाले छह-छह पोकेमॉन के दो दल बनाकर उनके स्तर बराबर करता है।
तैयार ✓ — खिलाड़ी 2 का इंतज़ार
तैयार ✓ — खिलाड़ी 1 का इंतज़ार
आप तैयार हैं · खिलाड़ी 1 का इंतज़ार।
खिलाड़ी 1 की सेटिंग का इंतज़ार है।`,
  ko: `PokéRogue 2Players
플레이어 2
플레이어 {{player}} 프로필
프로필 선택
선택한 프로필: {{label}}
선택한 프로필
이름
아이콘
게임패드
별
불꽃
풀
물
번개
색상
보라색
빨간색
파란색
초록색
노란색
저장
이 이름으로 프로필 만들기
각 프로필은 플레이 기록, 포획한 포켓몬, 설정을 따로 저장합니다. 프로필을 삭제하면 두 번 확인한 뒤 이 데이터도 삭제됩니다.
프로필 삭제
삭제 확인
취소
준비 완료
플레이어 1의 설정을 기다리는 중입니다.
2인 플레이
플레이어 1 · 설정
게임 모드
자유 듀오
블록 매치
무작위 빠른 배틀
블록당 배틀 수
{{total}} (AI 배틀 {{ai}}회 + 대전)
총 10회 배틀에서는 각 플레이어가 상대와 대전하기 전에 AI 배틀 9회에서 승리합니다.
블록 수
블록이 끝날 때마다 함께 대전합니다. 대전에서 이기면 1점을 얻고, AI 배틀은 점수를 주지 않습니다.
포획한 포켓몬 지원
없음
대전 전에 각 플레이어는 선택한 수만큼 팀의 포켓몬을 프로필에서 포획한 포켓몬으로 바꿀 수 있습니다. 포획한 포켓몬은 보관됩니다.
포켓몬 레벨
자동 레벨 조정
현재 레벨 유지
자동 모드는 진행도가 낮은 플레이어에 맞춰 대전 레벨을 5단위로 내림 조정합니다. 저장된 레벨은 바뀌지 않습니다.
자유 듀오에서 점수 대전 허용
대전 팀
완전 무작위 포켓몬, 균형 잡힌 레벨
컴퓨터가 균형 잡힌 팀 선택
각 플레이어는 서로 다른 포켓몬 6마리를 받습니다. 두 팀의 레벨은 같습니다.
컴퓨터가 기본 능력이 비슷한 6마리 팀 두 개를 만들고 레벨을 맞춥니다.
레벨
모두 같은 무작위 레벨
레벨 선택
무작위 모드에서는 포켓몬 12마리 모두 1부터 100 사이의 같은 무작위 레벨을 사용합니다.
선택한 레벨 (1~100)
매치 이어하기
준비 · 시작
진행 상황은 분리됩니다. 각 플레이어는 저장 데이터, 설정, 프로필, 터치 조작을 따로 사용합니다. 게임 중 일시 정지는 함께 적용됩니다.
2인 플레이 시 휴대전화를 세로로 잡으세요.
AI 승리: {{pveBattlesWon}} · 최고 웨이브: {{bestRunWave}} · 대전 승/패/무: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · 매치: {{matchesWon}}/{{matchesPlayed}} · 도감: 확인 {{seen}}, 포획 {{caught}}
포획 보관함: 포켓몬 {{count}}마리
포획한 포켓몬 없음
매치 규칙에 따라 이 복사본을 대전 팀원 대신 선택할 수 있습니다.
선택한 프로필:
프로필을 바꾸기 전에 진행 중인 매치를 완료하거나 이어 하세요.
프로필을 저장했습니다.
프로필 이름을 입력하세요.
프로필을 만들고 불러왔습니다. 진행도는 처음부터 시작합니다.
다른 플레이어가 이 프로필을 사용 중이므로 지금 삭제할 수 없습니다.
확인 1/2: {{avatar}} {{name}} 및 저장 데이터, 포획 기록, 통계를 모두 삭제할까요?
확인 2/2: 마지막 단계입니다. {{avatar}} {{name}}과 모든 진행 상황이 영구 삭제됩니다.
확인 (1/2)
영구 삭제
활성 프로필이 바뀌었습니다. 선택한 프로필에서 삭제를 다시 시작하세요.
프로필을 삭제하지 못했습니다. 변경된 내용이 없습니다.
저장 데이터와 포획 기록이 포함된 프로필을 삭제했습니다. 현재 불러온 프로필을 확인하세요.
삭제를 취소했습니다. 프로필은 유지됩니다.
진행 상황과 포획 기록이 포함된 프로필을 불러왔습니다.
블록 매치: 각 플레이어는 자신의 게임에서 AI와 싸웁니다. 둘 다 필요한 배틀에서 이기면 서로 대전합니다.
자유 듀오: 각자 원하는 속도로 AI 배틀을 진행합니다. 아래 옵션을 켜면 1점 대전을 시작할 수 있습니다.
빠른 배틀: 컴퓨터가 포켓몬 6마리로 된 팀 두 개를 바로 준비한 뒤 대전을 시작합니다. 솔로 프로필과 진행 상황은 바뀌지 않습니다.
컴퓨터가 균형 잡힌 팀 두 개 선택
무작위 포켓몬, 두 팀의 레벨은 동일
공통 무작위 레벨
포켓몬 12마리의 레벨 {{level}}
무작위 빠른 배틀: {{teams}} ({{level}}). AI 배틀 없이 1점 대전으로 시작합니다.
자유 듀오: 각자 AI 게임을 원하는 속도로 진행합니다. 1점을 걸고 대전하려면 대전을 누르세요.
자유 듀오: 각자 AI 게임을 원하는 속도로 진행합니다. 점수 대전이 꺼져 있습니다.
각 블록에는 플레이어마다 AI 배틀 {{ai}}회와 함께하는 대전 1회가 있습니다. {{blocks}}개 블록에서는 플레이어마다 AI 배틀 {{pve}}회, 대전 {{duels}}회가 진행됩니다. 대전 승리는 1점이며 AI 배틀은 점수를 주지 않습니다.
긴 매치입니다. 여러 번 나누어 플레이해야 할 수 있습니다.
서로 다른 포켓몬 12마리를 무작위로 고릅니다. 두 팀은 1부터 100 사이에서 무작위로 선택된 같은 레벨을 사용합니다.
컴퓨터가 기본 능력이 비슷한 6마리 팀 두 개를 만들고 레벨을 맞춥니다.
준비 완료 ✓ — 플레이어 2 대기 중
준비 완료 ✓ — 플레이어 1 대기 중
준비되었습니다 · 플레이어 1을 기다리는 중입니다.
플레이어 1의 설정을 기다리는 중입니다.`,
  ja: `PokéRogue 2Players
プレイヤー2
プレイヤー{{player}}のプロフィール
プロフィールを選択
選択中のプロフィール：{{label}}
選択中のプロフィール
名前
アイコン
ゲームパッド
星
炎
草
水
雷
色
紫
赤
青
緑
黄
保存
この名前でプロフィールを作成
各プロフィールには冒険、捕まえたポケモン、設定が保存されます。2回確認して削除すると、これらのデータも消去されます。
このプロフィールを削除
削除を確認
キャンセル
準備完了
プレイヤー1の設定を待っています。
2人プレイ
プレイヤー1 · 設定
ゲームモード
フリーデュオ
ブロックマッチ
ランダムクイックバトル
各ブロックのバトル数
{{total}}（AI戦{{ai}}回＋対戦）
合計10回のバトルでは、各プレイヤーがAIに9回勝ってから相手プレイヤーと対戦します。
ブロック数
各ブロックの終了後、2人で対戦します。対戦に勝つと1ポイント獲得し、AI戦ではポイントを獲得できません。
捕まえたポケモンを助っ人にする
なし
対戦前に、チームのポケモンを選んだ数までプロフィールの捕まえたポケモンと入れ替えられます。元のポケモンは保管されたままです。
ポケモンのレベル
自動調整
現在のレベルを維持
自動モードでは、進行度の低いプレイヤーに合わせて対戦レベルを5刻みで切り下げます。保存済みのレベルは変わりません。
フリーデュオでポイント対戦を許可
対戦チーム
完全ランダムなポケモン、レベルは均等
コンピューターが均衡の取れたチームを選択
各プレイヤーは異なるポケモンを6匹受け取ります。両チームのレベルは同じです。
コンピューターが基本能力の近い6匹のチームを2つ作り、レベルを揃えます。
レベル
全員共通のランダムレベル
レベルを選択
ランダムモードでは、12匹すべてが1～100から選ばれた同じレベルになります。
選択したレベル（1～100）
マッチを再開
準備完了 · 開始
進行状況は別々です。セーブ、設定、プロフィール、タッチ操作は各プレイヤー専用です。ゲーム中の一時停止は共有されます。
2人で遊ぶときはスマートフォンを縦向きにしてください。
AI戦勝利：{{pveBattlesWon}} · 最高ウェーブ：{{bestRunWave}} · 対戦勝/敗/分：{{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · マッチ：{{matchesWon}}/{{matchesPlayed}} · 図鑑：確認{{seen}}、捕獲{{caught}}
捕獲ボックス：{{count}}匹
捕獲したポケモンはいません
マッチのルールに応じて、これらのポケモンを対戦チームのメンバーと入れ替えられます。
選択中のプロフィール：
プロフィールを変更する前に、進行中のマッチを終了するか再開してください。
プロフィールを保存しました。
プロフィール名を入力してください。
プロフィールを作成して読み込みました。進行状況は最初から始まります。
このプロフィールは相手が使用中のため、今は削除できません。
確認1/2：{{avatar}} {{name}}とセーブ、捕獲、統計をすべて削除しますか？
確認2/2：最後の手順です。{{avatar}} {{name}}とすべての進行状況が完全に削除されます。
確認（1/2）
完全に削除
選択中のプロフィールが変わりました。選択したプロフィールから削除をやり直してください。
削除できませんでした。プロフィールは変更されていません。
セーブと捕獲データとともにプロフィールを削除しました。現在読み込まれているプロフィールを確認してください。
削除をキャンセルしました。プロフィールは保持されています。
進行状況と捕獲データを含むプロフィールを読み込みました。
ブロックマッチ：各プレイヤーは自分の冒険でAIと戦います。両方が必要なバトルに勝つと対戦します。
フリーデュオ：それぞれ自分のペースでAI戦を進めます。下の設定を有効にすると、1ポイントをかけて対戦できます。
クイックバトル：コンピューターが6匹ずつのチームをすぐに用意し、対戦を始めます。ソロのプロフィールや進行状況は変わりません。
コンピューターが均衡の取れた2チームを選択
ランダムなポケモン、両チームのレベルは同じ
共通のランダムレベル
12匹すべてレベル{{level}}
ランダムクイックバトル：{{teams}}（{{level}}）。AI戦はなく、1ポイントをかけた対戦から始まります。
フリーデュオ：それぞれ自分のペースでAI戦を進めます。「対戦」を選ぶと1ポイントをかけて遊べます。
フリーデュオ：それぞれ自分のペースでAI戦を進めます。ポイント対戦は無効です。
各ブロックでは、各プレイヤーがAI戦を{{ai}}回行い、2人で対戦を1回行います。{{blocks}}ブロックでは、各プレイヤーがAI戦を{{pve}}回、対戦を{{duels}}回行います。対戦に勝つと1ポイント、AI戦ではポイントを獲得できません。
長いマッチです。複数回に分けて遊ぶ必要があります。
異なるポケモンを12匹ランダムに選びます。両チームは1～100の同じランダムレベルになります。
コンピューターが基本能力の近い6匹のチームを2つ作り、レベルを揃えます。
準備完了 ✓ — プレイヤー2を待っています
準備完了 ✓ — プレイヤー1を待っています
準備完了 · プレイヤー1を待っています。
プレイヤー1の設定を待っています。`,
  "zh-Hans": `PokéRogue 2Players
玩家 2
玩家 {{player}} 的档案
选择档案
已选档案：{{label}}
已选档案
名称
图标
游戏手柄
星星
火焰
草
水
闪电
颜色
紫色
红色
蓝色
绿色
黄色
保存
使用此名称创建档案
每个档案都会保存自己的冒险、捕获记录和设置。确认两次后删除档案也会删除这些数据。
删除此档案
确认删除
取消
准备就绪
正在等待玩家 1 设置。
双人游戏
玩家 1 · 设置
游戏模式
自由双人
分组对战
随机快速对战
每组战斗数
{{total}}（{{ai}} 场 AI 战斗 + 对战）
总共 10 场战斗时，每位玩家先赢下 9 场 AI 战斗，再与另一位玩家对战。
组数
每组结束后，两位玩家进行一场对战。赢得对战获得 1 分；AI 战斗不计分。
捕获的宝可梦作为支援
无
对战前，每位玩家最多可以用档案中的捕获宝可梦替换队伍里所选数量的宝可梦。原捕获记录会保留。
宝可梦等级
自动平衡
保留当前等级
自动模式会按进度较低的玩家调整对战等级，并向下取整到 5 的倍数。已保存的等级不会改变。
允许自由双人进行积分对战
对战队伍
完全随机的宝可梦，等级平衡
由电脑挑选平衡队伍
每位玩家获得 6 只不同的宝可梦。两队等级相同。
电脑会组建两支基础能力相近的六只队伍，并统一等级。
等级
所有宝可梦使用相同随机等级
选择等级
随机模式下，12 只宝可梦的等级相同，范围为 1 到 100。
选择的等级（1 到 100）
继续比赛
准备就绪 · 开始
双方进度独立：各自拥有存档、设置、档案和触屏操作。游戏中的暂停由双方共用。
双人游玩时请竖直握持手机。
AI 胜场：{{pveBattlesWon}} · 最佳波次：{{bestRunWave}} · 对战胜/负/平：{{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · 比赛：{{matchesWon}}/{{matchesPlayed}} · 图鉴：见过 {{seen}}，捕获 {{caught}}
捕获仓库：{{count}} 只宝可梦
没有捕获记录
根据比赛规则，这些复制宝可梦可以替换对战队伍成员。
已选档案：
更换档案前，请先完成或继续当前比赛。
档案已保存。
请输入档案名称。
档案已创建并载入，进度从头开始。
另一位玩家正在使用此档案，暂时无法删除。
确认 1/2：删除 {{avatar}} {{name}} 及其全部存档、捕获记录和统计数据？
确认 2/2：最后一步。{{avatar}} {{name}} 及其全部进度将被永久删除。
确认（1/2）
永久删除
当前档案已更改。请从选中的档案重新开始删除流程。
删除失败，档案未更改。
档案及其存档和捕获记录已删除。请检查当前载入的档案。
已取消删除，档案已保留。
已载入档案及其进度和捕获记录。
分组对战：每位玩家在自己的冒险中与 AI 战斗。双方赢得规定数量的战斗后，进行玩家对战。
自由双人：双方各自按自己的节奏进行 AI 冒险。启用下方选项即可开始一场获得 1 分的对战。
快速对战：电脑立即准备两支各有六只宝可梦的队伍，然后开始对战。单人档案和进度不会改变。
电脑会选择两支平衡队伍
随机宝可梦，两队等级相同
共同随机等级
12 只宝可梦均为 {{level}} 级
随机快速对战：{{teams}}（{{level}}）。没有 AI 战斗；比赛以一场获得 1 分的对战开始。
自由双人：双方各自在自己的 AI 冒险中继续前进。点击“对战”即可争夺 1 分。
自由双人：双方各自在自己的 AI 冒险中继续前进。积分对战已关闭。
每组中，每位玩家进行 {{ai}} 场 AI 战斗，然后进行一场共同对战。{{blocks}} 组共进行：每位玩家 {{pve}} 场 AI 战斗和 {{duels}} 场对战。赢得对战获得 1 分；AI 战斗不计分。
比赛较长，可能需要分多次完成。
随机选择 12 只不同的宝可梦。两队等级相同，范围为 1 到 100。
电脑会组建两支基础能力相近的六只队伍，并统一等级。
准备就绪 ✓ — 等待玩家 2
准备就绪 ✓ — 等待玩家 1
你已准备就绪 · 正在等待玩家 1。
正在等待玩家 1 设置。`,
  "zh-Hant": `PokéRogue 2Players
玩家 2
玩家 {{player}} 的檔案
選擇檔案
已選檔案：{{label}}
已選檔案
名稱
圖示
遊戲手把
星星
火焰
草
水
閃電
顏色
紫色
紅色
藍色
綠色
黃色
儲存
使用此名稱建立檔案
每個檔案都會儲存自己的冒險、捕獲紀錄和設定。確認兩次後刪除檔案也會刪除這些資料。
刪除此檔案
確認刪除
取消
準備就緒
正在等候玩家 1 設定。
雙人遊戲
玩家 1 · 設定
遊戲模式
自由雙人
分組對戰
隨機快速對戰
每組戰鬥數
{{total}}（{{ai}} 場 AI 戰鬥 + 對戰）
總共 10 場戰鬥時，每位玩家先贏下 9 場 AI 戰鬥，再與另一位玩家對戰。
組數
每組結束後，兩位玩家會進行一場對戰。贏得對戰可獲得 1 分；AI 戰鬥不計分。
捕獲的寶可夢作為支援
無
對戰前，每位玩家最多可以用檔案中的捕獲寶可夢替換隊伍裡選定數量的寶可夢。原捕獲紀錄會保留。
寶可夢等級
自動平衡
保留目前等級
自動模式會依進度較低的玩家調整對戰等級，並向下取整至 5 的倍數。已儲存的等級不會改變。
允許自由雙人進行積分對戰
對戰隊伍
完全隨機的寶可夢，等級平衡
由電腦挑選平衡隊伍
每位玩家會取得 6 隻不同的寶可夢。兩隊等級相同。
電腦會組成兩支基礎能力相近的六隻隊伍，並統一等級。
等級
所有寶可夢使用相同隨機等級
選擇等級
隨機模式下，12 隻寶可夢的等級相同，範圍為 1 到 100。
選擇的等級（1 到 100）
繼續比賽
準備就緒 · 開始
雙方進度分開：各自擁有存檔、設定、檔案和觸控操作。遊戲中的暫停由雙方共用。
雙人遊玩時請直向握持手機。
AI 勝場：{{pveBattlesWon}} · 最佳波次：{{bestRunWave}} · 對戰勝/負/平：{{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · 比賽：{{matchesWon}}/{{matchesPlayed}} · 圖鑑：見過 {{seen}}，捕獲 {{caught}}
捕獲儲存庫：{{count}} 隻寶可夢
沒有捕獲紀錄
依照比賽規則，這些複製寶可夢可以替換對戰隊伍成員。
已選檔案：
更換檔案前，請先完成或繼續目前的比賽。
檔案已儲存。
請輸入檔案名稱。
檔案已建立並載入，進度從頭開始。
另一位玩家正在使用此檔案，因此目前無法刪除。
確認 1/2：刪除 {{avatar}} {{name}} 及其所有存檔、捕獲紀錄和統計資料？
確認 2/2：最後一步。{{avatar}} {{name}} 及其所有進度將永久刪除。
確認（1/2）
永久刪除
目前檔案已變更。請從選取的檔案重新開始刪除流程。
刪除失敗，檔案未變更。
檔案連同存檔和捕獲紀錄已刪除。請確認目前載入的檔案。
已取消刪除，檔案已保留。
已載入檔案及其進度和捕獲紀錄。
分組對戰：每位玩家在自己的冒險中與 AI 戰鬥。雙方贏得規定數量的戰鬥後，會進行玩家對戰。
自由雙人：雙方各自依自己的步調進行 AI 冒險。啟用下方選項即可開始一場獲得 1 分的對戰。
快速對戰：電腦立即準備兩支各有六隻寶可夢的隊伍，接著開始對戰。單人檔案和進度不會改變。
電腦會選擇兩支平衡隊伍
隨機寶可夢，兩隊等級相同
共同隨機等級
12 隻寶可夢皆為 {{level}} 級
隨機快速對戰：{{teams}}（{{level}}）。沒有 AI 戰鬥；比賽會以一場獲得 1 分的對戰開始。
自由雙人：雙方各自在自己的 AI 冒險中繼續前進。按下「對戰」即可爭奪 1 分。
自由雙人：雙方各自在自己的 AI 冒險中繼續前進。積分對戰已關閉。
每組中，每位玩家進行 {{ai}} 場 AI 戰鬥，接著進行一場共同對戰。{{blocks}} 組共進行：每位玩家 {{pve}} 場 AI 戰鬥和 {{duels}} 場對戰。贏得對戰可獲得 1 分；AI 戰鬥不計分。
比賽時間較長，可能需要分多次完成。
隨機選出 12 隻不同的寶可夢。兩隊等級相同，範圍為 1 到 100。
電腦會組成兩支基礎能力相近的六隻隊伍，並統一等級。
準備就緒 ✓ — 等候玩家 2
準備就緒 ✓ — 等候玩家 1
你已準備就緒 · 正在等候玩家 1。
正在等候玩家 1 設定。`,
  th: `PokéRogue 2Players
ผู้เล่น 2
โปรไฟล์ผู้เล่น {{player}}
เลือกโปรไฟล์
โปรไฟล์ที่เลือก: {{label}}
โปรไฟล์ที่เลือก
ชื่อ
ไอคอน
เกมแพด
ดาว
ไฟ
หญ้า
น้ำ
สายฟ้า
สี
ม่วง
แดง
น้ำเงิน
เขียว
เหลือง
บันทึก
สร้างโปรไฟล์ด้วยชื่อนี้
แต่ละโปรไฟล์เก็บการเล่น โปเกมอนที่จับได้ และการตั้งค่าของตัวเอง การลบโปรไฟล์จะลบข้อมูลเหล่านี้ด้วยหลังจากยืนยันสองครั้ง
ลบโปรไฟล์นี้
ยืนยันการลบ
ยกเลิก
พร้อม
กำลังรอการตั้งค่าของผู้เล่น 1
2 ผู้เล่น
ผู้เล่น 1 · ตั้งค่า
โหมดเกม
คู่เล่นอิสระ
แมตช์แบบบล็อก
แบตเทิลด่วนแบบสุ่ม
จำนวนแบตเทิลต่อบล็อก
{{total}} ({{ai}} กับ AI + ดวล)
ถ้ามีแบตเทิลทั้งหมด 10 ครั้ง ผู้เล่นแต่ละคนจะชนะ AI 9 ครั้งก่อนดวลกับอีกคน
จำนวนบล็อก
เมื่อจบบล็อกแต่ละบล็อก ทั้งสองคนจะดวลกัน ผู้ชนะการดวลได้ 1 คะแนน ส่วนแบตเทิลกับ AI ไม่ได้คะแนน
โปเกมอนที่จับได้สำหรับเสริมทีม
ไม่มี
ก่อนดวล ผู้เล่นแต่ละคนแทนที่โปเกมอนในทีมได้ตามจำนวนที่เลือกด้วยโปเกมอนจากโปรไฟล์ โปเกมอนที่จับได้ยังคงอยู่ในคลัง
เลเวลโปเกมอน
ปรับสมดุลอัตโนมัติ
ใช้เลเวลปัจจุบัน
โหมดอัตโนมัติจะปรับเลเวลในการดวลตามผู้เล่นที่มีความคืบหน้าน้อยกว่า โดยปัดลงทีละ 5 เลเวลที่บันทึกไว้จะไม่เปลี่ยน
อนุญาตให้ดวลชิงคะแนนในคู่เล่นอิสระ
ทีมสำหรับดวล
โปเกมอนสุ่มทั้งหมด เลเวลสมดุล
ให้คอมพิวเตอร์เลือกทีมที่สมดุล
ผู้เล่นแต่ละคนจะได้โปเกมอนต่างกัน 6 ตัว ทั้งสองทีมมีเลเวลเท่ากัน
คอมพิวเตอร์สร้างทีมละ 6 ตัวที่มีพลังพื้นฐานใกล้เคียงกัน แล้วปรับเลเวลให้เท่ากัน
เลเวล
สุ่มเลเวลเดียวกันสำหรับทุกตัว
เลือกเลเวล
ในโหมดสุ่ม โปเกมอนทั้ง 12 ตัวจะใช้เลเวลสุ่มเดียวกันตั้งแต่ 1 ถึง 100
เลเวลที่เลือก (1–100)
เล่นแมตช์ต่อ
พร้อม · เริ่ม
ความคืบหน้าแยกกัน: ผู้เล่นแต่ละคนมีเซฟ การตั้งค่า โปรไฟล์ และปุ่มสัมผัสของตัวเอง การพักเกมจะมีผลกับทั้งคู่
ถือโทรศัพท์แนวตั้งเพื่อเล่นสองคน
ชนะ AI: {{pveBattlesWon}} · เวฟสูงสุด: {{bestRunWave}} · ดวล ชนะ/แพ้/เสมอ: {{duelsWon}}/{{duelsLost}}/{{duelsDrawn}} · แมตช์: {{matchesWon}}/{{matchesPlayed}} · โปเกเด็กซ์: พบ {{seen}} จับได้ {{caught}}
คลังโปเกมอนที่จับได้: {{count}} ตัว
ยังไม่มีโปเกมอนที่จับได้
สามารถใช้สำเนาเหล่านี้แทนสมาชิกทีมในการดวลได้ตามกติกาแมตช์
โปรไฟล์ที่เลือก:
เล่นแมตช์ปัจจุบันให้จบหรือเล่นต่อก่อนเปลี่ยนโปรไฟล์
บันทึกโปรไฟล์แล้ว
กรอกชื่อโปรไฟล์นี้
สร้างและโหลดโปรไฟล์แล้ว ความคืบหน้าเริ่มต้นจากศูนย์
ผู้เล่นอีกคนกำลังใช้โปรไฟล์นี้ จึงลบตอนนี้ไม่ได้
ยืนยัน 1 จาก 2: ลบ {{avatar}} {{name}} รวมถึงเซฟ โปเกมอนที่จับได้ และสถิติทั้งหมดหรือไม่
ยืนยัน 2 จาก 2: ขั้นตอนสุดท้าย {{avatar}} {{name}} และความคืบหน้าทั้งหมดจะถูกลบถาวร
ยืนยัน (1/2)
ลบถาวร
โปรไฟล์ที่ใช้งานเปลี่ยนไป เริ่มการลบอีกครั้งจากโปรไฟล์ที่เลือก
ลบไม่สำเร็จ โปรไฟล์ไม่มีการเปลี่ยนแปลง
ลบโปรไฟล์พร้อมเซฟและโปเกมอนที่จับได้แล้ว ตรวจสอบว่าโหลดโปรไฟล์ใดอยู่
ยกเลิกการลบแล้ว โปรไฟล์ยังอยู่
โหลดโปรไฟล์พร้อมความคืบหน้าและโปเกมอนที่จับได้แล้ว
แมตช์แบบบล็อก: ผู้เล่นแต่ละคนต่อสู้กับ AI ในเกมของตัวเอง เมื่อทั้งคู่ชนะครบตามจำนวนแล้วจึงดวลกัน
คู่เล่นอิสระ: แต่ละคนเล่นกับ AI ในเกมของตัวเองตามจังหวะที่ต้องการ เปิดตัวเลือกด้านล่างเพื่อเริ่มดวลชิง 1 คะแนน
แบตเทิลด่วน: คอมพิวเตอร์เตรียมทีมโปเกมอนทีมละ 6 ตัวทันที แล้วเริ่มดวล โปรไฟล์และความคืบหน้าโหมดเล่นคนเดียวไม่เปลี่ยน
คอมพิวเตอร์เลือกทีมที่สมดุลสองทีม
โปเกมอนสุ่ม เลเวลของทั้งสองทีมเท่ากัน
เลเวลสุ่มร่วมกัน
เลเวล {{level}} สำหรับโปเกมอนทั้ง 12 ตัว
แบตเทิลด่วนแบบสุ่ม: {{teams}} ({{level}}) ไม่มีแบตเทิลกับ AI แมตช์เริ่มด้วยการดวลชิง 1 คะแนน
คู่เล่นอิสระ: แต่ละคนเล่นเกมกับ AI ต่อไปตามจังหวะของตัวเอง เลือกดวลเพื่อชิง 1 คะแนน
คู่เล่นอิสระ: แต่ละคนเล่นเกมกับ AI ต่อไปตามจังหวะของตัวเอง ปิดการดวลชิงคะแนนแล้ว
แต่ละบล็อกมีแบตเทิลกับ AI {{ai}} ครั้งต่อผู้เล่นหนึ่งคนและดวลร่วมกันหนึ่งครั้ง ใน {{blocks}} บล็อก: แบตเทิลกับ AI {{pve}} ครั้งต่อคนและดวล {{duels}} ครั้ง ชนะการดวลได้ 1 คะแนน แบตเทิลกับ AI ไม่ได้คะแนน
แมตช์ยาว อาจต้องเล่นหลายครั้ง
สุ่มโปเกมอนต่างกัน 12 ตัว ทั้งสองทีมมีเลเวลสุ่มเดียวกันตั้งแต่ 1 ถึง 100
คอมพิวเตอร์สร้างทีมละ 6 ตัวที่มีพลังพื้นฐานใกล้เคียงกัน แล้วปรับเลเวลให้เท่ากัน
พร้อม ✓ — กำลังรอผู้เล่น 2
พร้อม ✓ — กำลังรอผู้เล่น 1
คุณพร้อมแล้ว · กำลังรอผู้เล่น 1
กำลังรอการตั้งค่าของผู้เล่น 1`,
};

for (const [language, text] of Object.entries(EXTRA_LOCALE_TEXT)) {
  LOCALE_VALUES[language] = text.trim().split("\n");
}

// Solo supports Latin American Spanish with the Spain Spanish resource pack.
LOCALE_VALUES["es-419"] = LOCALE_VALUES["es-ES"];

const PROFILE_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;
const MESSAGES = Object.fromEntries(
  Object.entries(LOCALE_VALUES).map(([language, values]) => {
    if (values.length !== MESSAGE_KEYS.length) {
      throw new Error(`2P translation ${language} has ${values.length} values; expected ${MESSAGE_KEYS.length}`);
    }
    return [language, Object.fromEntries(MESSAGE_KEYS.map((key, index) => [key, values[index]]))];
  }),
);

const LANGUAGE_NAMES = Object.freeze({
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "es-ES": "Español (España)",
  "es-419": "Español (Latinoamérica)",
  "pt-BR": "Português (Brasil)",
  ca: "Català",
  eu: "Euskara",
  tr: "Türkçe",
  ru: "Русский",
  uk: "Українська",
  pl: "Polski",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  da: "Dansk",
  sv: "Svenska",
  tl: "Filipino",
  hi: "हिन्दी",
  ko: "한국어",
  ja: "日本語",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  th: "ไทย",
});

const LANGUAGE_PICKER_MESSAGES = {
  en: {
    language: "Language",
    languageAuto: "Automatic (solo / phone)",
    pause: "Pause",
    resume: "Resume",
    quit: "Quit",
    readyState: "Ready",
    pausedState: "Paused",
  },
  fr: {
    language: "Langue",
    languageAuto: "Automatique (solo / téléphone)",
    pause: "Pause",
    resume: "Reprendre",
    quit: "Quitter",
    readyState: "prêt",
    pausedState: "en pause",
  },
  de: {
    language: "Sprache",
    languageAuto: "Automatisch (Solo / Telefon)",
    pause: "Pause",
    resume: "Fortsetzen",
    quit: "Beenden",
    readyState: "bereit",
    pausedState: "pausiert",
  },
  it: {
    language: "Lingua",
    languageAuto: "Automatico (solo / telefono)",
    pause: "Pausa",
    resume: "Riprendi",
    quit: "Esci",
    readyState: "pronto",
    pausedState: "in pausa",
  },
  "es-ES": {
    language: "Idioma",
    languageAuto: "Automático (solo / teléfono)",
    pause: "Pausa",
    resume: "Reanudar",
    quit: "Salir",
    readyState: "listo",
    pausedState: "en pausa",
  },
  "es-419": {
    language: "Idioma",
    languageAuto: "Automático (solo / teléfono)",
    pause: "Pausa",
    resume: "Reanudar",
    quit: "Salir",
    readyState: "listo",
    pausedState: "en pausa",
  },
  "pt-BR": {
    language: "Idioma",
    languageAuto: "Automático (solo / telefone)",
    pause: "Pausar",
    resume: "Continuar",
    quit: "Sair",
    readyState: "pronto",
    pausedState: "pausado",
  },
  ca: {
    language: "Llengua",
    languageAuto: "Automàtica (solo / telèfon)",
    pause: "Pausa",
    resume: "Reprèn",
    quit: "Surt",
    readyState: "preparat",
    pausedState: "en pausa",
  },
  eu: {
    language: "Hizkuntza",
    languageAuto: "Automatikoa (solo / telefonoa)",
    pause: "Pausatu",
    resume: "Jarraitu",
    quit: "Irten",
    readyState: "prest",
    pausedState: "pausatuta",
  },
  tr: {
    language: "Dil",
    languageAuto: "Otomatik (solo / telefon)",
    pause: "Duraklat",
    resume: "Devam et",
    quit: "Çık",
    readyState: "hazır",
    pausedState: "duraklatıldı",
  },
  ru: {
    language: "Язык",
    languageAuto: "Автоматически (соло / телефон)",
    pause: "Пауза",
    resume: "Продолжить",
    quit: "Выйти",
    readyState: "готов",
    pausedState: "на паузе",
  },
  uk: {
    language: "Мова",
    languageAuto: "Автоматично (соло / телефон)",
    pause: "Пауза",
    resume: "Продовжити",
    quit: "Вийти",
    readyState: "готовий",
    pausedState: "призупинено",
  },
  pl: {
    language: "Język",
    languageAuto: "Automatycznie (solo / telefon)",
    pause: "Pauza",
    resume: "Wznów",
    quit: "Wyjdź",
    readyState: "gotowy",
    pausedState: "wstrzymano",
  },
  id: {
    language: "Bahasa",
    languageAuto: "Otomatis (solo / ponsel)",
    pause: "Jeda",
    resume: "Lanjutkan",
    quit: "Keluar",
    readyState: "siap",
    pausedState: "dijeda",
  },
  vi: {
    language: "Ngôn ngữ",
    languageAuto: "Tự động (solo / điện thoại)",
    pause: "Tạm dừng",
    resume: "Tiếp tục",
    quit: "Thoát",
    readyState: "sẵn sàng",
    pausedState: "đã tạm dừng",
  },
  da: {
    language: "Sprog",
    languageAuto: "Automatisk (solo / telefon)",
    pause: "Pause",
    resume: "Fortsæt",
    quit: "Afslut",
    readyState: "klar",
    pausedState: "sat på pause",
  },
  sv: {
    language: "Språk",
    languageAuto: "Automatiskt (solo / telefon)",
    pause: "Paus",
    resume: "Fortsätt",
    quit: "Avsluta",
    readyState: "redo",
    pausedState: "pausad",
  },
  tl: {
    language: "Wika",
    languageAuto: "Awtomatiko (solo / telepono)",
    pause: "I-pause",
    resume: "Ipagpatuloy",
    quit: "Lumabas",
    readyState: "handa",
    pausedState: "naka-pause",
  },
  hi: {
    language: "भाषा",
    languageAuto: "स्वचालित (सोलो / फ़ोन)",
    pause: "रोकें",
    resume: "जारी रखें",
    quit: "बाहर निकलें",
    readyState: "तैयार",
    pausedState: "रुका हुआ",
  },
  ko: {
    language: "언어",
    languageAuto: "자동 (솔로 / 휴대전화)",
    pause: "일시정지",
    resume: "계속하기",
    quit: "나가기",
    readyState: "준비됨",
    pausedState: "일시정지됨",
  },
  ja: {
    language: "言語",
    languageAuto: "自動（ソロ／端末）",
    pause: "一時停止",
    resume: "再開",
    quit: "終了",
    readyState: "準備完了",
    pausedState: "一時停止中",
  },
  "zh-Hans": {
    language: "语言",
    languageAuto: "自动（单人模式 / 设备）",
    pause: "暂停",
    resume: "继续",
    quit: "退出",
    readyState: "就绪",
    pausedState: "已暂停",
  },
  "zh-Hant": {
    language: "語言",
    languageAuto: "自動（單人模式／裝置）",
    pause: "暫停",
    resume: "繼續",
    quit: "離開",
    readyState: "就緒",
    pausedState: "已暫停",
  },
  th: {
    language: "ภาษา",
    languageAuto: "อัตโนมัติ (โหมดเดี่ยว / โทรศัพท์)",
    pause: "หยุดชั่วคราว",
    resume: "เล่นต่อ",
    quit: "ออก",
    readyState: "พร้อม",
    pausedState: "หยุดชั่วคราว",
  },
};

for (const language of Object.keys(MESSAGES)) {
  const pickerMessages = LANGUAGE_PICKER_MESSAGES[language];
  if (LANGUAGE_NAMES[language] === undefined || pickerMessages === undefined) {
    throw new Error(`Missing two-player language picker translation for ${language}`);
  }
  Object.assign(MESSAGES[language], pickerMessages);
}

export const TWO_PLAYER_LANGUAGES = Object.freeze(
  Object.entries(LANGUAGE_NAMES).map(([code, name]) => Object.freeze({ code, name })),
);

function normalizeLanguage(candidate) {
  if (typeof candidate !== "string" || candidate.trim() === "") {
    return null;
  }
  const value = candidate.trim().replaceAll("_", "-");
  const exact = Object.keys(MESSAGES).find(language => language.toLowerCase() === value.toLowerCase());
  if (exact) {
    return exact;
  }
  const lower = value.toLowerCase();
  if (lower === "es" || lower.startsWith("es-")) {
    return lower === "es-es" ? "es-ES" : "es-419";
  }
  if (lower === "pt" || lower.startsWith("pt-")) {
    return "pt-BR";
  }
  if (lower === "zh" || lower.startsWith("zh-")) {
    return /^zh-(tw|hk|mo|hant)(-|$)/i.test(value) ? "zh-Hant" : "zh-Hans";
  }
  if (lower === "fil" || lower.startsWith("fil-")) {
    return "tl";
  }
  const base = lower.split("-")[0];
  return Object.keys(MESSAGES).find(language => language.toLowerCase() === base) ?? null;
}

function preferredSoloLanguage(storage) {
  try {
    const scope = storage.getItem(SOLO_LANGUAGE_SCOPE_KEY);
    if (scope === "solo") {
      return storage.getItem("prLang");
    }
    if (scope?.startsWith("profile:")) {
      const profileId = scope.slice("profile:".length);
      if (PROFILE_ID_PATTERN.test(profileId)) {
        return storage.getItem(`${PROFILE_ROOT}${profileId}/prLang`);
      }
    }

    const globalLanguage = storage.getItem("prLang");
    if (globalLanguage) {
      return globalLanguage;
    }

    const registry = JSON.parse(storage.getItem(PROFILE_REGISTRY_KEY) ?? "null");
    const selectedProfile = registry?.version === 1 ? registry.selected?.j1 : null;
    if (PROFILE_ID_PATTERN.test(selectedProfile ?? "")) {
      return storage.getItem(`${PROFILE_ROOT}${selectedProfile}/prLang`);
    }
  } catch {
    // Missing, blocked, or malformed local storage falls back to device locale.
  }
  return null;
}

function resolveLanguage(storage, nav) {
  const preferred = normalizeLanguage(preferredSoloLanguage(storage));
  if (preferred) {
    return preferred;
  }
  const candidates = Array.isArray(nav?.languages) ? [...nav.languages] : [];
  candidates.push(nav?.language);
  return candidates.map(normalizeLanguage).find(Boolean) ?? "en";
}

export function createTwoPlayerI18n(storage = window.localStorage, nav = window.navigator, doc = window.document) {
  let selection = "auto";
  try {
    const savedLanguage = storage.getItem(SHELL_LANGUAGE_KEY);
    if (savedLanguage === "auto") {
      selection = "auto";
    } else if (TWO_PLAYER_LANGUAGES.some(language => language.code === savedLanguage)) {
      selection = savedLanguage;
    }
  } catch {
    // A blocked local storage still allows changing language for this visit.
  }
  let language = selection === "auto" ? resolveLanguage(storage, nav) : selection;
  let messages = MESSAGES[language] ?? MESSAGES.en;
  const translate = (key, args = {}) => {
    const message = messages[key] ?? MESSAGES.en[key] ?? key;
    return message.replace(/\{\{(\w+)\}\}/g, (placeholder, name) => String(args[name] ?? placeholder));
  };

  function applyStatic() {
    doc.documentElement.lang = language;
    for (const element of doc.querySelectorAll("[data-i18n]")) {
      const prefix = element.dataset.i18nPrefix ?? "";
      let args = {};
      try {
        args = JSON.parse(element.dataset.i18nArgs ?? "{}");
      } catch {
        // Invalid static translation arguments are ignored.
      }
      element.textContent = prefix + translate(element.dataset.i18n, args);
    }
    for (const element of doc.querySelectorAll("[data-i18n-aria-label]")) {
      element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
    }
    for (const element of doc.querySelectorAll("[data-i18n-title]")) {
      element.setAttribute("title", translate(element.dataset.i18nTitle));
    }
  }

  function setLanguage(nextSelection) {
    if (nextSelection === "auto") {
      selection = "auto";
      language = resolveLanguage(storage, nav);
      try {
        storage.removeItem(SHELL_LANGUAGE_KEY);
      } catch {
        // Keep the in-memory selection even when persistence is unavailable.
      }
    } else if (TWO_PLAYER_LANGUAGES.some(candidate => candidate.code === nextSelection)) {
      selection = nextSelection;
      language = nextSelection;
      try {
        storage.setItem(SHELL_LANGUAGE_KEY, nextSelection);
      } catch {
        // Keep the in-memory selection even when persistence is unavailable.
      }
    } else {
      return language;
    }
    messages = MESSAGES[language] ?? MESSAGES.en;
    applyStatic();
    return language;
  }

  return {
    get language() {
      return language;
    },
    get selection() {
      return selection;
    },
    languages: TWO_PLAYER_LANGUAGES,
    t: translate,
    applyStatic,
    setLanguage,
  };
}

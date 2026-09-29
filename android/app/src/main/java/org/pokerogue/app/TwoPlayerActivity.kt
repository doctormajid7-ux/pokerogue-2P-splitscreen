/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package org.pokerogue.app

/**
 * Coque locale à deux joueurs : la page coque (`shell/2p.html`), tenue en portrait.
 *
 * Elle héberge deux cadres de même origine, un par joueur, dont l'URL porte
 * `?player=j1` / `?player=j2` : chaque partie garde ainsi son propre espace de
 * stockage (voir `src/system/player-storage.ts`), et la moitié haute est
 * retournée pour le joueur d'en face.
 *
 * Tout le reste — WebViewAssetLoader, politique de navigation, sondage de
 * capacités, écran d'erreur, cycle de vie — vient de [MainActivity].
 */
class TwoPlayerActivity : MainActivity() {
    override fun startUrl(): String = "https://$HOST/assets/www/shell/2p.html"
}

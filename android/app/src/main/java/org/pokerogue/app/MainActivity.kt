/*
 * SPDX-FileCopyrightText: 2026 Pagefault Games
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

package org.pokerogue.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONException
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max

/**
 * Coque Android solo de PokéRogue (lot A2 du plan de portage).
 *
 * Le build web (`dist/`) est embarqué dans les assets et servi depuis
 * `https://appassets.androidplatform.net/assets/www/` via [WebViewAssetLoader] :
 * une origine https locale permet le DOM storage et évite les restrictions de
 * `file://`. Les données de jeu (localStorage) restent dans le stockage interne
 * de l'application.
 *
 * Politique de navigation : seul l'hôte d'assets tourne dans la WebView ; les
 * liens http(s) externes partent dans le navigateur ; tout le reste est bloqué.
 * Aucun pont JavaScript n'est exposé et l'application ne déclare aucune
 * permission (donc pas de réseau du tout en usage normal).
 */
open class MainActivity : Activity() {

    companion object {
        private const val TAG = "PokeRogueShell"
        protected const val HOST = "appassets.androidplatform.net"
        private const val START_URL = "https://$HOST/assets/www/shell/solo.html"

        /** Délai laissé à la WebView pour se remettre en page après une rotation. */
        private const val RELAYOUT_SETTLE_MS = 400L

        /**
         * Sondage lancé à la fin du chargement : WebGL (rendu Phaser), DOM
         * storage (sauvegardes) et Web Audio (son). Un échec affiche l'écran
         * d'erreur natif plutôt que de laisser un jeu noir figé.
         */
        private const val CAPABILITY_PROBE = """
            (function () {
              try {
                var c = document.createElement('canvas');
                var webgl = !!(window.WebGLRenderingContext &&
                  (c.getContext('webgl') || c.getContext('experimental-webgl')));
                var storage = false;
                try {
                  localStorage.setItem('pokerogue_probe', '1');
                  localStorage.removeItem('pokerogue_probe');
                  storage = true;
                } catch (e) {}
                var audio = !!(window.AudioContext || window.webkitAudioContext);
                // evaluateJavascript sérialise déjà la valeur retournée en JSON :
                // renvoyer l'objet directement (une string reviendrait échappée
                // et fausserait toute lecture côté Kotlin).
                return { webgl: webgl, storage: storage, audio: audio };
              } catch (e) {
                return { webgl: false, storage: false, audio: false };
              }
            })();
        """

        /**
         * Géométrie observée par la page : taille du viewport de mise en page
         * (`innerWidth`/`innerHeight`), taille de la zone réellement visible
         * (`visualViewport`, qui rétrécit dès que le document est zoomé ou
         * rogné) et rapport de densité.
         */
        private const val VIEWPORT_PROBE = """
            (function () {
              try {
                var vv = window.visualViewport;
                return {
                  w: window.innerWidth,
                  h: window.innerHeight,
                  vw: vv ? vv.width : window.innerWidth,
                  vh: vv ? vv.height : window.innerHeight,
                  scale: vv ? vv.scale : 1,
                  dpr: window.devicePixelRatio || 1
                };
              } catch (e) {
                return { w: 0, h: 0, vw: 0, vh: 0, dpr: 1 };
              }
            })();
        """
    }

    private lateinit var assetLoader: WebViewAssetLoader
    private var webView: WebView? = null
    private var errorView: LinearLayout? = null
    private var errorText: TextView? = null

    /** Un seul essai de relance douce par rotation, avant de conclure au rechargement. */
    private var relayoutAttempted = false

    /** Neutralise les sondages postés qui arriveraient après la destruction. */
    private var destroyed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)

        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        val web = WebView(this).also { webView = it }
        web.setBackgroundColor(Color.BLACK)

        web.settings.apply {
            javaScriptEnabled = true
            // La progression est en localStorage : stockage interne de l'app.
            domStorageEnabled = true
            databaseEnabled = true
            // La page débloque l'audio au premier contact ; ne pas y ajouter la
            // clock média automatique.
            mediaPlaybackRequiresUserGesture = false
            // Tout arrive par shouldInterceptRequest : pas d'accès fichiers.
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Le document déclare lui-même `width=device-width,
            // initial-scale=1` : le viewport doit suivre la taille de la
            // WebView, pas une vue d'ensemble calculée au chargement. Un
            // `useWideViewPort` + `loadWithOverviewMode` actifs figent l'échelle
            // initiale : après une rotation sans recréation d'activité, le jeu
            // restait zoomé et rogné (contenu plus large que la zone visible).
            useWideViewPort = false
            loadWithOverviewMode = false
            setSupportZoom(false) // méthode sans getter : pas de propriété Kotlin
            builtInZoomControls = false
            displayZoomControls = false
        }

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                return routeUri(uri)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                checkCapabilities()
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                message?.let {
                    Log.d(TAG, "${it.message()} (${it.sourceId()}:${it.lineNumber()})")
                }
                return true
            }
        }

        val root = FrameLayout(this)
        root.addView(
            web,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        root.addView(
            buildErrorView(),
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        )
        setContentView(root)

        web.loadUrl(startUrl())
    }

    /** Page chargée au lancement. La coque 2P hérite de tout le reste. */
    protected open fun startUrl(): String = START_URL

    /**
     * Seul l'hôte d'assets est chargé dans la WebView. Un lien http(s) externe
     * (wiki, Discord…) part dans le navigateur ; toute autre URL (file:,
     * intent:, javascript:…) est bloquée.
     *
     * @return `true` si la WebView ne doit pas charger l'URL elle-même.
     */
    private fun routeUri(uri: Uri): Boolean {
        if ("https" == uri.scheme && HOST == uri.host) {
            return false // navigation normale dans l'application
        }
        if ("http" == uri.scheme || "https" == uri.scheme) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (e: ActivityNotFoundException) {
                Log.i(TAG, "pas de navigateur pour $uri")
            }
            return true
        }
        Log.w(TAG, "navigation bloquée : $uri")
        return true
    }

    // ------------------------------------------------------- écran d'erreur

    private fun buildErrorView(): View {
        val box = LinearLayout(this).also { errorView = it }
        box.orientation = LinearLayout.VERTICAL
        box.setBackgroundColor(Color.parseColor("#CC000000"))
        box.setPadding(48, 96, 48, 48)
        box.visibility = View.GONE

        val title = TextView(this)
        title.text = getString(R.string.error_title)
        title.setTextColor(Color.WHITE)
        title.textSize = 20f
        box.addView(title)

        val detail = TextView(this).also { errorText = it }
        detail.setTextColor(Color.parseColor("#FFCCB0"))
        detail.textSize = 15f
        box.addView(detail)

        val retry = Button(this)
        retry.text = getString(R.string.error_retry)
        retry.setOnClickListener {
            box.visibility = View.GONE
            webView?.reload()
        }
        box.addView(retry)
        return box
    }

    private fun checkCapabilities() {
        val web = webView ?: return
        web.evaluateJavascript(CAPABILITY_PROBE) { result ->
            // Le résultat arrive sérialisé en JSON (« null » si la page n'a rien
            // renvoyé). En cas d'indécision on laisse le jeu tourner : mieux
            // vaut un jeu jouable qu'un écran d'erreur masquant une page saine.
            val probe = try {
                JSONObject(result ?: "null")
            } catch (e: JSONException) {
                Log.w(TAG, "sondage de capacités illisible : $result")
                return@evaluateJavascript
            }
            val missing = mutableListOf<String>()
            if (!probe.optBoolean("webgl", false)) missing += "WebGL"
            if (!probe.optBoolean("storage", false)) missing += "localStorage"
            if (!probe.optBoolean("audio", false)) missing += "Web Audio"
            if (missing.isEmpty()) {
                errorView?.visibility = View.GONE
            } else {
                Log.e(TAG, "capacités WebView manquantes : $missing")
                errorText?.text = getString(R.string.error_missing, missing.joinToString(", "))
                errorView?.visibility = View.VISIBLE
            }
        }
    }

    // ------------------------------------------------------------- cycle de vie

    override fun onPause() {
        // Fige les timers JS et la boucle Phaser ; Phaser suspend aussi l'audio
        // sur perte de focus (pauseOnBlur). La progression est déjà dans le
        // localStorage, un arrêt brutal du processus ne perd donc pas la partie.
        webView?.pauseTimers()
        webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        webView?.onResume()
        webView?.resumeTimers()
        val web = webView
        web?.post { if (!destroyed) Log.d(TAG, "viewport WebView : ${web.width}x${web.height}") }
    }

    // ---------------------------------------------------------- rotation

    /**
     * La rotation (et tout autre changement de configuration absorbé par le
     * manifeste) ne recrée **pas** l'activité : la partie en cours continue de
     * tourner au lieu de repartir du dernier point de sauvegarde.
     *
     * La WebView se re-met en page elle-même quand sa taille change. On lui
     * envoie aussi un `resize` explicite pour que Phaser recalcule le cadre,
     * même si WebView n'émet pas son propre événement lors de la rotation.
     * Enfin, [checkViewport] vérifie que le viewport visible n'est pas zoomé.
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        hideSystemBars()
        relayoutAttempted = false
        val web = webView ?: return
        web.requestLayout()
        web.postDelayed({
            if (destroyed || webView !== web) {
                return@postDelayed
            }
            web.evaluateJavascript("window.dispatchEvent(new Event('resize'));", null)
            checkViewport("après rotation")
        }, RELAYOUT_SETTLE_MS)
    }

    /**
     * Compare la taille que la page croit avoir à celle de la WebView.
     *
     * Les deux sont exprimées en pixels physiques : la page raisonne en pixels
     * CSS, donc `innerWidth × devicePixelRatio`. Un écart dans la tolérance est
     * un simple arrondi ; au-delà, la géométrie est périmée. Le facteur de
     * `visualViewport` repère aussi un zoom navigateur même si `innerWidth` reste
     * cohérent. Un premier écart déclenche une relance douce ; si le document
     * reste zoomé ou rogné, on recharge la page en dernier recours.
     */
    private fun checkViewport(stage: String) {
        val web = webView ?: return
        if (destroyed) {
            return
        }
        web.evaluateJavascript(VIEWPORT_PROBE) { result ->
            if (destroyed || webView !== web) {
                return@evaluateJavascript
            }
            val probe = try {
                JSONObject(result ?: "null")
            } catch (e: JSONException) {
                Log.w(TAG, "sondage de viewport illisible : $result")
                return@evaluateJavascript
            }
            val ratio = probe.optDouble("dpr", 1.0).let { if (it > 0) it else 1.0 }
            val pageWidth = probe.optDouble("w", 0.0) * ratio
            val pageHeight = probe.optDouble("h", 0.0) * ratio
            val visibleWidth = probe.optDouble("vw", 0.0) * ratio
            val pageScale = probe.optDouble("scale", 1.0)
            val zoomed = abs(pageScale - 1.0) > 0.03
            val viewWidth = web.width.toDouble()
            val viewHeight = web.height.toDouble()
            if (pageWidth <= 0.0 || pageHeight <= 0.0 || viewWidth <= 0.0 || viewHeight <= 0.0) {
                return@evaluateJavascript // rien de mesurable : ne rien conclure
            }
            Log.d(
                TAG,
                "viewport $stage : WebView ${viewWidth.toInt()}x${viewHeight.toInt()}, " +
                    "page ${pageWidth.toInt()}x${pageHeight.toInt()}, " +
                    "visibleWidth ${visibleWidth.toInt()}, pageScale $pageScale"
            )
            val coherent = abs(pageWidth - viewWidth) <= max(8.0, viewWidth * 0.03) &&
                abs(pageHeight - viewHeight) <= max(8.0, viewHeight * 0.03)
            val widthCropped = visibleWidth > 0.0 && visibleWidth < pageWidth - max(8.0, pageWidth * 0.03)
            val cropped = zoomed || widthCropped
            if (coherent && !cropped) {
                relayoutAttempted = false
                return@evaluateJavascript
            }
            if (!relayoutAttempted) {
                relayoutAttempted = true
                Log.w(TAG, "viewport $stage incohérent (rogné=$cropped) : relance de la mise en page")
                web.requestLayout()
                web.evaluateJavascript("window.dispatchEvent(new Event('resize'));", null)
                web.postDelayed({ checkViewport("après relance") }, RELAYOUT_SETTLE_MS)
            } else if (cropped) {
                Log.w(TAG, "viewport $stage irrécupérable sans recharger : rechargement de la page")
                web.reload()
            } else {
                Log.d(TAG, "viewport $stage toujours décalé mais complet : laissé tel quel")
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemBars()
        }
    }

    /**
     * Plein écran immersif : barres système masquées, réaffichables d'un
     * balayage depuis le bord.
     *
     * L'API d'insets remplace les drapeaux `systemUiVisibility` obsolètes, et
     * surtout le décor n'est **pas** mis en bord-à-bord : la fenêtre reste
     * dimensionnée sur la zone réellement visible, donc le canvas du jeu ne
     * passe jamais sous une barre système (c'était la cause du rendu « coupé »
     * quand les barres réapparaissaient après une rotation).
     */
    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val web = webView
            if (web != null && web.canGoBack()) {
                web.goBack()
            } else {
                // Laisse la session en mémoire plutôt que de détruire l'activité.
                moveTaskToBack(true)
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        destroyed = true
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}

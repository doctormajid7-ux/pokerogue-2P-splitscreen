import "#app/polyfills"; // All polyfills MUST be loaded first for side effects
import "#init/init-manifest"; // initializes the manifest, must be done *before* i18n is initialized due to being used for caching
import "#app/i18n"; // Initializes i18n on import

import { InvertPostFX } from "#app/pipelines/invert";
import { isMobile, preventDoubleTapZoom } from "#app/touch-controls";
import { isBeta, isDev } from "#constants/app-constants";
import { version } from "#package.json";
import { initShellBridge } from "#system/shell-bridge";
import Phaser from "phaser";
import BBCodeTextPlugin from "phaser3-rex-plugins/plugins/bbcodetext-plugin";
import InputTextPlugin from "phaser3-rex-plugins/plugins/inputtext-plugin";
import TransitionImagePackPlugin from "phaser3-rex-plugins/templates/transitionimagepack/transitionimagepack-plugin";
import UIPlugin from "phaser3-rex-plugins/templates/ui/ui-plugin";

if (isBeta || isDev) {
  document.title += " (Beta)";
}

preventDoubleTapZoom();

function enableAndroidSoloPinchZoom(): void {
  const root = document.documentElement;
  const activePointers = new Map<number, { x: number; y: number; target: Element }>();
  let landscape = window.matchMedia("(orientation: landscape)").matches;
  // Phaser's FIT mode already sizes the canvas to the available viewport.
  // Start at 1 in both orientations so solo matches the 2P iframe's sizing.
  let zoom = 1;
  let pinchGestureActive = false;
  let pinchPointerIds = new Set<number>();
  let previousPinchDistance = 0;
  let dispatchingPointerCancel = false;

  const applyZoom = (nextZoom: number): void => {
    zoom = Math.min(2, Math.max(0.65, nextZoom));
    root.style.setProperty("--android-solo-zoom", String(zoom));
  };
  const getPinchDistance = (): number => {
    const pointers = [...activePointers.values()];
    if (pointers.length < 2) {
      return 0;
    }
    const first = pointers[0]!;
    const second = pointers[1]!;
    return Math.hypot(first.x - second.x, first.y - second.y);
  };
  const cancelGamePointers = (): void => {
    dispatchingPointerCancel = true;
    try {
      for (const [pointerId, pointer] of activePointers) {
        pointer.target.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "touch",
            clientX: pointer.x,
            clientY: pointer.y,
          }),
        );
      }
    } finally {
      dispatchingPointerCancel = false;
    }
  };

  applyZoom(zoom);

  const resetZoomForOrientation = (): void => {
    requestAnimationFrame(() => {
      const nextLandscape = window.matchMedia("(orientation: landscape)").matches;
      if (nextLandscape !== landscape) {
        landscape = nextLandscape;
        applyZoom(1);
      }
    });
  };
  window.addEventListener("resize", resetZoomForOrientation, { passive: true });
  window.addEventListener("orientationchange", resetZoomForOrientation, { passive: true });

  document.addEventListener(
    "pointerdown",
    event => {
      if (dispatchingPointerCancel || event.pointerType !== "touch") {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("#app")) {
        return;
      }

      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, target });
      if (pinchGestureActive) {
        pinchPointerIds.add(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (activePointers.size < 2) {
        return;
      }

      pinchGestureActive = true;
      pinchPointerIds = new Set(activePointers.keys());
      previousPinchDistance = getPinchDistance();
      event.preventDefault();
      event.stopPropagation();
      cancelGamePointers();
    },
    { capture: true, passive: false },
  );

  document.addEventListener(
    "pointermove",
    event => {
      const pointer = activePointers.get(event.pointerId);
      if (!pointer) {
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!pinchGestureActive || !pinchPointerIds.has(event.pointerId)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const distance = getPinchDistance();
      if (pinchPointerIds.size >= 2 && previousPinchDistance > 0 && distance > 0) {
        applyZoom(zoom * (distance / previousPinchDistance));
      }
      previousPinchDistance = distance;
    },
    { capture: true, passive: false },
  );

  const finishPointer = (event: PointerEvent): void => {
    if (dispatchingPointerCancel) {
      return;
    }
    if (pinchGestureActive && pinchPointerIds.has(event.pointerId)) {
      event.preventDefault();
      event.stopPropagation();
      pinchPointerIds.delete(event.pointerId);
    }
    activePointers.delete(event.pointerId);
    if (pinchGestureActive && pinchPointerIds.size === 0) {
      pinchGestureActive = false;
      previousPinchDistance = 0;
    }
  };
  document.addEventListener("pointerup", finishPointer, { capture: true, passive: false });
  document.addEventListener("pointercancel", finishPointer, { capture: true, passive: false });
}

// The Android solo launcher reserves a separate bottom dock for touch keys.
// Two-player frames have their own half-screen layout and do not use this dock.
if (new URLSearchParams(window.location.search).get("androidSolo") === "1") {
  document.documentElement.dataset.androidSolo = "true";
  enableAndroidSoloPinchZoom();
}
if (["j1", "j2"].includes(new URLSearchParams(window.location.search).get("player") ?? "")) {
  document.documentElement.dataset.android2p = "true";
}

async function startGame(): Promise<void> {
  const LoadingScene = (await import("./loading-scene")).LoadingScene;
  const BattleScene = (await import("./battle-scene")).BattleScene;
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "app",
    scale: {
      width: 1920,
      height: 1080,
      mode: Phaser.Scale.FIT,
    },
    plugins: {
      global: [
        {
          key: "rexInputTextPlugin",
          plugin: InputTextPlugin,
          start: true,
        },
        {
          key: "rexBBCodeTextPlugin",
          plugin: BBCodeTextPlugin,
          start: true,
        },
        {
          key: "rexTransitionImagePackPlugin",
          plugin: TransitionImagePackPlugin,
          start: true,
        },
      ],
      scene: [
        {
          key: "rexUI",
          plugin: UIPlugin,
          mapping: "rexUI",
        },
      ],
    },
    input: {
      mouse: {
        target: "app",
      },
      touch: {
        target: "app",
      },
      gamepad: true,
    },
    dom: {
      createContainer: true,
    },
    antialias: false,
    pipeline: [InvertPostFX] as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [LoadingScene, BattleScene],
    version,
  });
  game.sound.pauseOnBlur = isMobile();
  // No-op in the solo game; connects the frame to the 2P shell when embedded.
  initShellBridge(game);
}

try {
  await Promise.all([document.fonts.load("16px emerald"), document.fonts.load("10px pkmnems")]);
} catch (err) {
  console.error("Error loading fonts:", err);
} finally {
  await startGame();
}

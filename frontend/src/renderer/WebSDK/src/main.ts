// @ts-nocheck
/* eslint-disable no-underscore-dangle */
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from "./lappdelegate";
import * as LAppDefine from "./lappdefine";
import { LAppGlManager } from "./lappglmanager";
import { LAppLive2DManager } from "./lapplive2dmanager";

/**
 * Initialize the Live2D application
 */
export function initializeLive2D(): void {
  console.log(
    "[Live2D] Initializing Live2D with resourcePath:",
    LAppDefine.ResourcesPath
  );
  console.log("[Live2D] Model directories:", LAppDefine.ModelDir);

  // Check if canvas element exists in DOM before proceeding
  const canvasElement = document.getElementById('canvas');
  if (!canvasElement) {
    console.error('[Live2D] Canvas element not found in DOM. Make sure the component is mounted.');
    return;
  }

  // Clean up any existing instances first
  const hasExistingDelegate = !!LAppDelegate.getInstance();
  const hasExistingGLManager = !!LAppGlManager.getInstance();

  if (hasExistingDelegate || hasExistingGLManager) {
    console.log('[Live2D] Releasing existing instances');

    // Release existing model resources first
    LAppLive2DManager.releaseInstance();

    // Release delegate (this will dispose CubismFramework)
    if (hasExistingDelegate) {
      LAppDelegate.releaseInstance();
    }

    // Release GL manager
    if (hasExistingGLManager) {
      LAppGlManager.releaseInstance();
    }

    // Small delay to ensure cleanup is complete
    // This is important to avoid conflicts during re-initialization
  }

  // Initialize GL Manager first (this will get the canvas element)
  const glManager = LAppGlManager.getInstance();
  if (!glManager) {
    console.error('[Live2D] Failed to initialize GL Manager');
    return;
  }

  // Create new delegate instance and initialize
  // This will call initializeCubism() which properly initializes CubismFramework
  const delegate = LAppDelegate.getInstance();
  if (!delegate || !delegate.initialize()) {
    console.error("Failed to initialize Live2D");
    return;
  }

  delegate.run();

  (window as any).getLive2DManager = () => LAppLive2DManager.getInstance();

  // Make sure LAppAdapter is available globally
  if (!(window as any).getLAppAdapter) {
    console.log('[Live2D] Setting up getLAppAdapter function');
    const { LAppAdapter } = require('./lappadapter');
    (window as any).getLAppAdapter = () => LAppAdapter.getInstance();
  }

  if ((window as any).api?.setIgnoreMouseEvent) {
    const parent = document.getElementById("live2d");

    parent?.addEventListener("pointermove", (e) => {
      const model = LAppLive2DManager.getInstance().getModel(0);
      const view = LAppDelegate.getInstance().getView();

      // Transform screen coordinates to Live2D canvas coordinates
      const x = view?._deviceToScreen.transformX(e.x);
      const y = view?._deviceToScreen.transformY(e.y);

      // Check if mouse is over the Live2D model
      (window as any).api.setIgnoreMouseEvent(!model?.anyhitTest(x, y) && !model?.isHitOnModel(x, y));
    });

    // Add pointerdown event listener
    parent?.addEventListener("pointerdown", (e) => {
      const model = LAppLive2DManager.getInstance().getModel(0);
      const view = LAppDelegate.getInstance().getView();

      // Transform screen coordinates to Live2D canvas coordinates
      const x = view?._deviceToScreen.transformX(e.x);
      const y = view?._deviceToScreen.transformY(e.y);

      // Test hit and log result
      const hitAreaName = model?.anyhitTest(x, y);
      const isHit = hitAreaName !== null || model?.isHitOnModel(x, y);
      console.log("Model clicked:", isHit, hitAreaName ? `in area: ${hitAreaName}` : '');
    });
  }
}

/**
 * Keep the original window.load handler for backwards compatibility
 * (for the standalone HTML file)
 */
/* // Comment out the window.load listener
window.addEventListener(
  "load",
  (): void => {
    initializeLive2D();
  },
  { passive: true }
);
*/

/**
 * 終了時の処理
 * 结束时的处理
 */
window.addEventListener(
  "beforeunload",
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);

/**
 * Process when changing screen size.
 */
window.addEventListener(
  "resize",
  () => {
    if (LAppDefine.CanvasSize === "auto") {
      LAppDelegate.getInstance().onResize();
    }
  },
  { passive: true }
);

// Make the initialization function available globally
(window as any).initializeLive2D = initializeLive2D;

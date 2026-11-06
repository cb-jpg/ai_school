// @ts-nocheck
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

export let canvas: HTMLCanvasElement | null = null;
export let gl: WebGLRenderingContext | null = null;
export let s_instance: LAppGlManager | null = null;
/**
 * Cubism SDKのサンプルで使用するWebGLを管理するクラス
 */
export class LAppGlManager {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppGlManager {
    if (s_instance == null) {
      s_instance = new LAppGlManager();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  constructor() {
    // Use existing canvas instead of creating a new one
    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    // canvas = document.createElement("canvas");

    if (!canvas) {
      console.warn("Canvas element not found during LAppGlManager initialization");
      return;
    }

     // 显式固定上下文属性（2026-11-06 App「人物模型不见」热修）：
     // preserveDrawingBuffer=true 让绘图缓冲生命周期不再依赖「合成后自动失效」
     // 的隐性行为——旧 Android WebView（华为系等）对该机制的两端都出过故障：
     // 不失效→人物像素逐帧堆积（v2.61 根治的「一堆人物模型」）；显式清屏后
     // 缓冲被合成器整体丢弃→人物整个不可见。现在每帧显式 clear(COLOR|DEPTH)
     // （见 lappdelegate.run），preserve=true 不会 reintroduce 堆积。alpha/
     // premultipliedAlpha 显式写默认值，避免老 WebView 实现差异。
     gl = canvas.getContext("webgl2", {
       alpha: true,
       premultipliedAlpha: true,
       preserveDrawingBuffer: true,
       antialias: true,
     });

     if (!gl) {
       // gl初期化失敗
       alert("Cannot initialize WebGL. This browser does not support.");
       gl = null;

       document.body.innerHTML =
         "This browser does not support the <code>&lt;canvas&gt;</code> element.";
     }
  }

  /**
   * 解放する。
   */
  public release(): void {}
}

package com.shishi.ai;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int MEDIA_PERMISSION_REQUEST_CODE = 4001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 从 Launch(启动图)主题切到正式主题（白窗口背景）：
        // WebView 表面只有布局视口高(~793px)，其下的物理底部手势条区由窗口背景绘制；
        // 不切的话那里永远显示启动图，全屏白色图层(下拉菜单)会被衬出"覆盖不全"
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);
        // 展示场景常亮，避免讲解中息屏
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        requestMediaPermissions();
        forceWebViewNetworkSettings();
    }

    /**
     * 部分 ROM 的 WebView 默认混合内容模式不是 ALWAYS_ALLOW：
     * fetch 放行但 http 图片被"自动升级 https"后连不上非 TLS 后端，
     * Live2D 纹理加载全部失败（2026-08-31 真机踩坑）。这里显式钉死。
     */
    private void forceWebViewNetworkSettings() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            android.util.Log.d("AISchool", "before: mixed=" + settings.getMixedContentMode()
                    + " blockImg=" + settings.getBlockNetworkImage()
                    + " blockLoads=" + settings.getBlockNetworkLoads());
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setBlockNetworkImage(false);
            settings.setBlockNetworkLoads(false);
            android.util.Log.d("AISchool", "after: mixed=" + settings.getMixedContentMode()
                    + " blockImg=" + settings.getBlockNetworkImage()
                    + " blockLoads=" + settings.getBlockNetworkLoads());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // 防止 ROM/其它组件在生命周期中改写图片加载设置
        forceWebViewNetworkSettings();
    }

    /**
     * WebView getUserMedia 的前置条件：原生层先持有麦克风/摄像头运行时权限。
     * 只声明 manifest 不够（Android 6.0+），Capacitor 的 BridgeWebChromeClient
     * 只在 App 已持有对应权限时才会批准 WebView 的采集请求。
     */
    private void requestMediaPermissions() {
        String[] wanted = { Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA };
        List<String> missing = new ArrayList<>();
        for (String perm : wanted) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this, missing.toArray(new String[0]), MEDIA_PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onBackPressed() {
        // WebView 无历史时回退键退到后台而非退出，避免误触丢会话
        if (getBridge() != null && getBridge().getWebView() != null
                && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
        } else {
            moveTaskToBack(true);
        }
    }
}

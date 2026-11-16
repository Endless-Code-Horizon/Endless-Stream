package com.endless.stream;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExoPlayerPlugin.class);
        super.onCreate(savedInstanceState);

        // Enforce maximum display refresh rate (60Hz / 90Hz / 120Hz) for ultra-smooth 60+ FPS UI
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Display display = getDisplay();
                if (display != null) {
                    Display.Mode[] modes = display.getSupportedModes();
                    Display.Mode maxMode = null;
                    for (Display.Mode mode : modes) {
                        if (maxMode == null || mode.getRefreshRate() > maxMode.getRefreshRate()) {
                            maxMode = mode;
                        }
                    }
                    if (maxMode != null) {
                        WindowManager.LayoutParams params = getWindow().getAttributes();
                        params.preferredDisplayModeId = maxMode.getModeId();
                        getWindow().setAttributes(params);
                    }
                }
            } catch (Exception ignored) {}
        }

        // Enable Hardware Acceleration and High Performance WebSettings
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                WebSettings settings = webView.getSettings();
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setOffscreenPreRaster(true);
            }
        } catch (Exception ignored) {}
    }
}

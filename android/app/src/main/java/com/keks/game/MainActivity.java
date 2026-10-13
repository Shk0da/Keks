package com.keks.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Единственная Activity: полноэкранный WebView с офлайн-игрой
 * (android/assets/www/, собирается tools/build-www.sh).
 * Никаких разрешений, никакой сети — прогресс в localStorage.
 *
 * Кнопка «Назад» отдаётся игре: window.__keksBack(exitFn) решает,
 * что делать (пауза / лагерь / титул), двойное нажатие на титуле — выход.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // экран не гаснет во время данжа
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);        // localStorage — сейвы
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            // alert()/confirm() игры — нативными диалогами
            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                showJsDialog(message, false, result);
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                showJsDialog(message, true, result);
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "KeksExit");
        setContentView(web);
        web.loadUrl(START_URL);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onBackPressed() {
        if (web != null) {
            web.evaluateJavascript(
                    "window.__keksBack ? window.__keksBack(function(){KeksExit.exit()}) : 0",
                    null);
            return;
        }
        super.onBackPressed();
    }

    private void showJsDialog(String message, boolean cancellable, final JsResult result) {
        runOnUiThread(() -> {
            AlertDialog.Builder b = new AlertDialog.Builder(MainActivity.this)
                    .setTitle(getString(R.string.app_name))
                    .setMessage(message)
                    .setCancelable(false)
                    .setPositiveButton("ОК", (d, w) -> result.confirm());
            if (cancellable) {
                b.setNegativeButton("Отмена", (d, w) -> result.cancel());
            }
            b.show();
        });
    }

    /** Выход из приложения (двойное «Назад» на титуле). */
    private class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Демоницы будут скучать", Toast.LENGTH_SHORT).show();
                finish();
            });
        }
    }
}

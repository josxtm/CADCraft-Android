package com.josxtm.cadcraft;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import androidx.webkit.WebViewAssetLoader;
public class MainActivity extends Activity {
 private WebView view;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  view = new WebView(this); setContentView(view);
  WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  WebSettings settings = view.getSettings();
  settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
  view.setWebChromeClient(new WebChromeClient());
  view.setWebViewClient(new WebViewClient() {
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req) {
    WebResourceResponse response=loader.shouldInterceptRequest(req.getUrl());
    if(response!=null && req.getUrl().getPath()!=null && req.getUrl().getPath().endsWith(".wasm")) response.setMimeType("application/wasm");
    return response;
   }
  });
  view.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");
 }
 @Override public void onBackPressed(){ if(view!=null && view.canGoBack()) view.goBack(); else super.onBackPressed(); }
 @Override protected void onDestroy(){ if(view!=null) view.destroy(); super.onDestroy(); }
}
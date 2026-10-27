package com.josxtm.cadcraft;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int OPEN_FILE = 300;
    private static final int SAVE_FILE = 301;
    private WebView view;
    private ValueCallback<Uri[]> uploadCallback;
    private static final int MAX_SAVE_BYTES = 32 * 1024 * 1024;
    private final Object saveLock = new Object();
    private File pendingSave;
    private String pendingName;
    private String saveBridge;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try (InputStream in = getAssets().open("bridge/files.js")) {
            ByteArrayOutputStream script = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = in.read(buffer)) != -1) script.write(buffer, 0, count);
            saveBridge = new String(script.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception error) {
            throw new IllegalStateException("Falta el puente de archivos Android", error);
        }
        if (savedInstanceState != null) {
            String token = savedInstanceState.getString("pendingSaveToken");
            if (token != null && token.startsWith("cadcraft-save-") && new File(token).getName().equals(token)) {
                File restored = new File(getCacheDir(), token);
                if (restored.isFile() && restored.length() <= MAX_SAVE_BYTES) {
                    pendingSave = restored;
                    pendingName = savedInstanceState.getString("pendingSaveName", "dibujo.dxf");
                }
            }
        }
        view = new WebView(this);
        view.setFocusableInTouchMode(true);
        setContentView(view);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        view.addJavascriptInterface(new AndroidFiles(), "AndroidFiles");
        view.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if(uploadCallback!=null)uploadCallback.onReceiveValue(null);
                uploadCallback=callback;
                try {
                    Intent intent = params.createIntent();
                    // SAF providers often label DXF/JSON as application/octet-stream.
                    // Let the app validate extensions/content after selection.
                    intent.setAction(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.removeExtra(Intent.EXTRA_MIME_TYPES);
                    startActivityForResult(intent,OPEN_FILE);
                    return true;
                } catch(Exception ex){
                    // Returning true means we own completion, including failure.
                    uploadCallback=null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this,"No se pudo abrir el selector",Toast.LENGTH_LONG).show();
                    return true;
                }
            }
        });
        view.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
                WebResourceResponse response=loader.shouldInterceptRequest(request.getUrl());
                if(response!=null && request.getUrl().getPath()!=null && request.getUrl().getPath().endsWith(".wasm")){
                    response.setMimeType("application/wasm");
                }
                return response;
            }
            @Override public void onPageFinished(WebView v,String url){
                v.evaluateJavascript(saveBridge,null);
                if(url.endsWith("/assets/web/index.html")){
                    v.evaluateJavascript("if(!document.getElementById('cadcraftCommandScript')){" +
                        "var s=document.createElement('script');s.id='cadcraftCommandScript';" +
                        "s.src='../bridge/commands.js';document.head.appendChild(s);}",null);
                    // Loads the Android-side selection UI after the patched CADCraft WASM starts.
                    v.evaluateJavascript("if(!document.getElementById('cadcraftSelectionScript')){" +
                        "var s=document.createElement('script');s.id='cadcraftSelectionScript';" +
                        "s.src='../bridge/selection.js';document.head.appendChild(s);}",null);
                    v.evaluateJavascript(
                        "(function(){if(document.getElementById('cadcraft3dlaunch'))return;" +
                        "var b=document.createElement('button');b.id='cadcraft3dlaunch';b.textContent='3D EXTRUIR';" +
                        "b.style.cssText='position:fixed;right:12px;bottom:48px;z-index:2147483647;background:#215da8;color:white;border:1px solid #adc3dd;border-radius:9px;padding:12px;font:600 15px sans-serif;box-shadow:0 3px 12px #0008';" +
                        "b.addEventListener('click',function(){location.href='../3d/index.html'});" +
                        "var d=document.createElement('button');d.id='cadcraftdxfhandoff';d.textContent='DXF A 3D';" +
                        "d.style.cssText='position:fixed;right:12px;bottom:104px;z-index:2147483647;background:#176b62;color:white;border:1px solid #a8ded6;border-radius:9px;padding:12px;font:600 15px sans-serif';" +
                        "var f=document.createElement('input');f.type='file';f.accept='.dxf,application/dxf';f.style.display='none';" +
                        "d.addEventListener('click',function(){f.click()});" +
                        "f.addEventListener('change',async function(){if(!f.files||!f.files[0])return;try{var t=await f.files[0].text();if(t.length>5000000)throw Error('DXF demasiado grande');sessionStorage.setItem('cadcraft.android.dxf.handoff',t);location.href='../3d/index.html'}catch(e){alert('DXF: '+e.message)}finally{f.value=''}});" +
                        "document.body.appendChild(f);document.body.appendChild(d);" +
                        "document.body.appendChild(b);})()", null);
                }
            }
        });
        view.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");
    }

    final class AndroidFiles {
        @JavascriptInterface public boolean save(String name,String base64,String mime) {
            synchronized (saveLock) {
                if (pendingSave != null) return false;
                File prepared = null;
                try {
                    if (base64 == null || base64.length() > ((MAX_SAVE_BYTES + 2L) / 3L) * 4L) return false;
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                    if (bytes.length > MAX_SAVE_BYTES) return false;
                    prepared = File.createTempFile("cadcraft-save-", ".tmp", getCacheDir());
                    try (OutputStream out = new FileOutputStream(prepared)) { out.write(bytes); }
                    pendingSave = prepared;
                    pendingName = (name == null || name.trim().isEmpty()) ? "dibujo.dxf" : new File(name).getName();
                    String contentType = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
                    runOnUiThread(() -> {
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType(contentType);
                        intent.putExtra(Intent.EXTRA_TITLE, pendingName);
                        try { startActivityForResult(intent, SAVE_FILE); }
                        catch (Exception error) {
                            clearPendingSave();
                            saveResult("error", "No se pudo abrir Guardar como");
                        }
                    });
                    return true;
                } catch (Exception error) {
                    if (prepared != null) prepared.delete();
                    pendingSave = null;
                    pendingName = null;
                    return false;
                }
            }
        }
        @JavascriptInterface public void report(String error) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this,error,Toast.LENGTH_LONG).show());
        }
    }

    private void clearPendingSave() {
        synchronized (saveLock) {
            if (pendingSave != null) pendingSave.delete();
            pendingSave = null;
            pendingName = null;
        }
    }

    private void saveResult(String status, String message) {
        Toast.makeText(getApplicationContext(), message, Toast.LENGTH_LONG).show();
        if (view != null && !isDestroyed()) {
            String detail = "{status:" + JSONObject.quote(status) + ",message:" + JSONObject.quote(message) + "}";
            view.evaluateJavascript("window.dispatchEvent(new CustomEvent('cadcraft-file-save',{detail:" + detail + "}));", null);
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        synchronized (saveLock) {
            if (pendingSave != null) {
                state.putString("pendingSaveToken", pendingSave.getName());
                state.putString("pendingSaveName", pendingName);
            }
        }
        super.onSaveInstanceState(state);
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (requestCode == OPEN_FILE) {
            ValueCallback<Uri[]> callback = uploadCallback;
            uploadCallback = null;
            if (callback != null) callback.onReceiveValue(selectedDocuments(resultCode,data));
        } else if (requestCode == SAVE_FILE) {
            final File source;
            final String name;
            synchronized (saveLock) {
                source = pendingSave;
                name = pendingName;
                pendingSave = null;
                pendingName = null;
            }
            if (resultCode != RESULT_OK) {
                if (source != null) source.delete();
                saveResult("cancelled", "Guardado cancelado; el proyecto sigue abierto");
            } else if (source == null || data == null || data.getData() == null) {
                if (source != null) source.delete();
                saveResult("error", "No se pudo recuperar el archivo pendiente; vuelve a guardar");
            } else {
                Uri destination = data.getData();
                // Document providers may be slow. Do not block the WebView/UI.
                new Thread(() -> {
                    String status = "saved", message = "Archivo guardado: " + name;
                    try (InputStream in = new FileInputStream(source);
                         OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                        if (out == null) throw new java.io.IOException("No hay acceso al archivo");
                        byte[] buffer = new byte[8192];
                        int count;
                        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                        out.flush();
                    } catch (Exception error) {
                        status = "error";
                        message = "Error al guardar: " + error.getMessage();
                    } finally { source.delete(); }
                    final String outcome = status, notice = message;
                    runOnUiThread(() -> saveResult(outcome, notice));
                }, "cadcraft-document-save").start();
            }
        }
    }

    // We launch ACTION_OPEN_DOCUMENT ourselves, so parse its result directly
    // rather than delegating to the installed WebView provider's picker parser.
    private static Uri[] selectedDocuments(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null) return null;
        ClipData selected = data.getClipData();
        if (selected != null && selected.getItemCount() > 0) {
            Uri[] uris = new Uri[selected.getItemCount()];
            for (int i = 0; i < uris.length; i++) {
                uris[i] = selected.getItemAt(i).getUri();
                if (uris[i] == null) return null;
            }
            return uris;
        }
        return data.getData() == null ? null : new Uri[]{data.getData()};
    }
    @Override public void onBackPressed(){
        if(view!=null&&view.canGoBack())view.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        if(uploadCallback!=null){uploadCallback.onReceiveValue(null);uploadCallback=null;}
        if(isFinishing())clearPendingSave();
        if(view!=null)view.destroy();
        super.onDestroy();
    }
}

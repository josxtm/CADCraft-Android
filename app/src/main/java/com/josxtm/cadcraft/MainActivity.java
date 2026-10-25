package com.josxtm.cadcraft;

import android.app.Activity;
import android.content.Intent;
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

public class MainActivity extends Activity {
    private static final int OPEN_FILE = 300;
    private static final int SAVE_FILE = 301;
    private WebView view;
    private ValueCallback<Uri[]> uploadCallback;
    private byte[] pendingSave;
    private String pendingName = "dibujo.dxf";

    private static final String SAVE_BRIDGE =
        "(function(){if(window.__cadAndroidSaveInstalled)return;window.__cadAndroidSaveInstalled=true;" +
        "function send(url,name){fetch(url).then(r=>r.blob()).then(b=>{" +
        "let reader=new FileReader();reader.onload=function(){" +
        "let value=String(reader.result);AndroidFiles.save(name||'dibujo.dxf',value.substring(value.indexOf(',')+1),b.type||'application/octet-stream');};" +
        "reader.onerror=function(){AndroidFiles.report('No se pudo leer el archivo');};reader.readAsDataURL(b);" +
        "}).catch(e=>AndroidFiles.report(String(e)));}" +
        "const original=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){let href=this.href||'';" +
        "if(href.startsWith('blob:')||href.startsWith('data:')){send(href,this.download);return;}" +
        "return original.apply(this,arguments);};" +
        "document.addEventListener('click',function(e){let a=e.target.closest&&e.target.closest('a[download]');" +
        "if(a&&(a.href.startsWith('blob:')||a.href.startsWith('data:'))){" +
        "e.preventDefault();e.stopImmediatePropagation();send(a.href,a.download);}},true);" +
        "})();";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        view = new WebView(this);
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
                    Intent intent=params.createIntent();
                    startActivityForResult(intent,OPEN_FILE);
                    return true;
                } catch(Exception ex){
                    uploadCallback=null;
                    Toast.makeText(MainActivity.this,"No se pudo abrir el selector",Toast.LENGTH_LONG).show();
                    return false;
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
                v.evaluateJavascript(SAVE_BRIDGE,null);
                if(url.endsWith("/assets/web/index.html")){
                    v.evaluateJavascript(
                        "(function(){if(document.getElementById('cadcraft3dlaunch'))return;" +
                        "var b=document.createElement('button');b.id='cadcraft3dlaunch';b.textContent='3D EXTRUIR';" +
                        "b.style.cssText='position:fixed;right:12px;bottom:48px;z-index:2147483647;background:#215da8;color:white;border:1px solid #adc3dd;border-radius:9px;padding:12px;font:600 15px sans-serif;box-shadow:0 3px 12px #0008';" +
                        "b.addEventListener('click',function(){location.href='../3d/index.html'});" +
                        "document.body.appendChild(b);})()", null);
                }
            }
        });
        view.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");
    }

    private class AndroidFiles {
        @JavascriptInterface public void save(String name,String base64,String mime) {
            try {
                byte[] bytes=Base64.decode(base64,Base64.DEFAULT);
                runOnUiThread(()->{
                    pendingSave=bytes;
                    pendingName=(name==null||name.trim().isEmpty())?"dibujo.dxf":name;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime==null||mime.isEmpty()?"application/octet-stream":mime);
                    intent.putExtra(Intent.EXTRA_TITLE,pendingName);
                    try { startActivityForResult(intent,SAVE_FILE); }
                    catch(Exception e){Toast.makeText(MainActivity.this,"No se pudo abrir Guardar como",Toast.LENGTH_LONG).show();}
                });
            } catch(Exception e){report("No se pudo preparar el archivo");}
        }
        @JavascriptInterface public void report(String error) {
            runOnUiThread(()->Toast.makeText(MainActivity.this,error,Toast.LENGTH_LONG).show());
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==OPEN_FILE){
            if(uploadCallback!=null){
                uploadCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode,data));
                uploadCallback=null;
            }
        }else if(requestCode==SAVE_FILE){
            if(resultCode==RESULT_OK && data!=null && data.getData()!=null && pendingSave!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                    if(out==null)throw new Exception("No hay acceso al archivo");
                    out.write(pendingSave);
                    Toast.makeText(this,"Plano guardado: "+pendingName,Toast.LENGTH_LONG).show();
                }catch(Exception e){Toast.makeText(this,"Error al guardar: "+e.getMessage(),Toast.LENGTH_LONG).show();}
            }
            pendingSave=null;
        }
    }
    @Override public void onBackPressed(){
        if(view!=null&&view.canGoBack())view.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy(){if(view!=null)view.destroy();super.onDestroy();}
}

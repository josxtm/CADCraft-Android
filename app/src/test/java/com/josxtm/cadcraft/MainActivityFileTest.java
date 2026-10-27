package com.josxtm.cadcraft;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.util.Base64;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowActivity;
import org.robolectric.shadows.ShadowToast;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class MainActivityFileTest {
    private ActivityController<MainActivity> controller;
    private MainActivity activity;
    private final byte[] payload = "{\"nombre\":\"diseño\"}\n".getBytes(StandardCharsets.UTF_8);

    @Before public void setUp() {
        controller = Robolectric.buildActivity(MainActivity.class).setup();
        activity = controller.get();
        ShadowToast.reset();
    }

    @After public void tearDown() {
        controller.pause().stop().destroy();
        File[] files = activity.getCacheDir().listFiles();
        if (files != null) for (File file : files) if (file.getName().startsWith("cadcraft-save-")) file.delete();
    }

    private WebView webView() {
        return (WebView) ((FrameLayout) activity.findViewById(android.R.id.content)).getChildAt(0);
    }

    private boolean save(String name) {
        return activity.new AndroidFiles().save(name, Base64.encodeToString(payload, Base64.NO_WRAP), "application/json");
    }

    private ShadowActivity.IntentForResult nextIntent() {
        shadowOf(Looper.getMainLooper()).idle();
        return shadowOf(activity).getNextStartedActivityForResult();
    }

    private void waitForToast(String prefix) throws Exception {
        long deadline = System.nanoTime() + 5_000_000_000L;
        while (System.nanoTime() < deadline) {
            shadowOf(Looper.getMainLooper()).idle();
            String text = ShadowToast.getTextOfLatestToast();
            if (text != null && text.startsWith(prefix)) return;
            Thread.sleep(10);
        }
        fail("Missing result: " + prefix + "; latest toast: " + ShadowToast.getTextOfLatestToast());
    }

    @Test public void saveUsesCreateDocumentAndKeepsFirstPayload() {
        assertTrue(save("original.json"));
        assertFalse(save("replacement.json"));
        ShadowActivity.IntentForResult launch = nextIntent();
        assertEquals(Intent.ACTION_CREATE_DOCUMENT, launch.intent.getAction());
        assertTrue(launch.intent.hasCategory(Intent.CATEGORY_OPENABLE));
        assertEquals("application/json", launch.intent.getType());
        assertEquals("original.json", launch.intent.getStringExtra(Intent.EXTRA_TITLE));
        assertNull(shadowOf(activity).getNextStartedActivityForResult());
    }

    @Test public void cancelReleasesSaveAndRemovesTemporaryFile() {
        assertTrue(save("cancel.json"));
        int request = nextIntent().requestCode;
        Bundle state = new Bundle();
        activity.onSaveInstanceState(state);
        File cached = new File(activity.getCacheDir(), state.getString("pendingSaveToken"));
        assertTrue(cached.exists());
        activity.onActivityResult(request, Activity.RESULT_CANCELED, null);
        assertFalse(cached.exists());
        assertTrue(ShadowToast.getTextOfLatestToast().startsWith("Guardado cancelado"));
        assertTrue(save("retry.json"));
    }

    @Test public void selectedDestinationReceivesExactBytes() throws Exception {
        assertTrue(save("roundtrip.json"));
        int request = nextIntent().requestCode;
        Uri uri = Uri.parse("content://documents/roundtrip.json");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        shadowOf(activity.getContentResolver()).registerOutputStream(uri, output);
        activity.onActivityResult(request, Activity.RESULT_OK, new Intent().setData(uri));
        waitForToast("Archivo guardado:");
        assertArrayEquals(payload, output.toByteArray());
        assertTrue(save("next.json"));
    }

    @Test public void writeErrorDoesNotReportSuccessAndAllowsRetry() throws Exception {
        assertTrue(save("error.json"));
        int request = nextIntent().requestCode;
        Uri uri = Uri.parse("content://documents/denied.json");
        shadowOf(activity.getContentResolver()).registerOutputStream(uri, new java.io.OutputStream() {
            @Override public void write(int value) throws IOException { throw new IOException("provider denied write"); }
        });
        activity.onActivityResult(request, Activity.RESULT_OK, new Intent().setData(uri));
        waitForToast("Error al guardar:");
        assertTrue(save("retry.json"));
    }

    @Test public void missingDestinationReportsErrorAndAllowsRetry() {
        assertTrue(save("missing.json"));
        activity.onActivityResult(nextIntent().requestCode, Activity.RESULT_OK, new Intent());
        assertTrue(ShadowToast.getTextOfLatestToast().startsWith("No se pudo recuperar"));
        assertTrue(save("retry.json"));
    }

    @Test public void closeFailureDoesNotReportSaved() throws Exception {
        assertTrue(save("close-error.json"));
        int request = nextIntent().requestCode;
        Uri uri = Uri.parse("content://documents/close-error.json");
        shadowOf(activity.getContentResolver()).registerOutputStream(uri, new ByteArrayOutputStream() {
            @Override public void close() throws IOException { throw new IOException("provider close failed"); }
        });
        activity.onActivityResult(request, Activity.RESULT_OK, new Intent().setData(uri));
        waitForToast("Error al guardar:");
        assertTrue(save("retry.json"));
    }

    @Test public void pendingBytesSurviveActivityRecreation() throws Exception {
        assertTrue(save("restored.json"));
        int request = nextIntent().requestCode;
        Bundle state = new Bundle();
        activity.onSaveInstanceState(state);
        controller.pause().stop().destroy();
        controller = Robolectric.buildActivity(MainActivity.class).create(state).start().resume();
        activity = controller.get();
        assertFalse(save("must-not-replace.json"));
        Uri uri = Uri.parse("content://documents/restored.json");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        shadowOf(activity.getContentResolver()).registerOutputStream(uri, output);
        activity.onActivityResult(request, Activity.RESULT_OK, new Intent().setData(uri));
        waitForToast("Archivo guardado: restored.json");
        assertArrayEquals(payload, output.toByteArray());
    }

    @Test public void invalidBase64DoesNotReservePicker() {
        assertFalse(activity.new AndroidFiles().save("invalid.json", "a", "application/json"));
        assertTrue(save("valid.json"));
    }

    private WebChromeClient.FileChooserParams chooserParams() {
        return new WebChromeClient.FileChooserParams() {
            @Override public int getMode() { return MODE_OPEN; }
            @Override public String[] getAcceptTypes() { return new String[]{"application/json", ".dxf"}; }
            @Override public boolean isCaptureEnabled() { return false; }
            @Override public CharSequence getTitle() { return null; }
            @Override public String getFilenameHint() { return null; }
            @Override public Intent createIntent() {
                return new Intent(Intent.ACTION_GET_CONTENT).setType("application/json");
            }
        };
    }

    @Test public void openUsesSystemDocumentPickerAndCompletesCancelOnce() {
        List<Uri[]> results = new ArrayList<>();
        WebView view = webView();
        assertTrue(view.getWebChromeClient().onShowFileChooser(view, results::add, chooserParams()));
        ShadowActivity.IntentForResult launch = nextIntent();
        assertEquals(Intent.ACTION_OPEN_DOCUMENT, launch.intent.getAction());
        assertEquals("*/*", launch.intent.getType());
        assertTrue(launch.intent.hasCategory(Intent.CATEGORY_OPENABLE));
        activity.onActivityResult(launch.requestCode, Activity.RESULT_CANCELED, null);
        activity.onActivityResult(launch.requestCode, Activity.RESULT_CANCELED, null);
        assertEquals(1, results.size());
        assertNull(results.get(0));
    }

    @Test public void repeatedOpeningReturnsSameUriToNewCallback() {
        List<Uri[]> results = new ArrayList<>();
        WebView view = webView();
        Uri uri = Uri.parse("content://documents/same.json");
        for (int attempt = 0; attempt < 2; attempt++) {
            assertTrue(view.getWebChromeClient().onShowFileChooser(view, results::add, chooserParams()));
            activity.onActivityResult(nextIntent().requestCode, Activity.RESULT_OK, new Intent().setData(uri));
        }
        assertEquals(2, results.size());
        assertEquals(uri, results.get(0)[0]);
        assertEquals(uri, results.get(1)[0]);
    }

    @Test public void openAcceptsClipDataAndMissingResultWithoutLosingCallback() {
        List<Uri[]> results = new ArrayList<>();
        WebView view = webView();
        Uri first = Uri.parse("content://documents/first.dxf"), second = Uri.parse("content://documents/second.dxf");
        ClipData clip = ClipData.newRawUri("files", first);
        clip.addItem(new ClipData.Item(second));
        assertTrue(view.getWebChromeClient().onShowFileChooser(view, results::add, chooserParams()));
        Intent selection = new Intent();
        selection.setClipData(clip);
        activity.onActivityResult(nextIntent().requestCode, Activity.RESULT_OK, selection);
        assertArrayEquals(new Uri[]{first, second}, results.get(0));
        assertTrue(view.getWebChromeClient().onShowFileChooser(view, results::add, chooserParams()));
        activity.onActivityResult(nextIntent().requestCode, Activity.RESULT_OK, null);
        assertEquals(2, results.size());
        assertNull(results.get(1));
    }

    public static class NoPickerActivity extends MainActivity {
        @Override public void startActivityForResult(Intent intent, int requestCode) {
            throw new ActivityNotFoundException("No document provider");
        }
    }

    @Test public void unavailableOpenPickerCompletesCallbackOnce() {
        try (ActivityController<NoPickerActivity> unavailable = Robolectric.buildActivity(NoPickerActivity.class).setup()) {
            MainActivity target = unavailable.get();
            WebView view = (WebView) ((FrameLayout) target.findViewById(android.R.id.content)).getChildAt(0);
            List<Uri[]> results = new ArrayList<>();
            assertTrue(view.getWebChromeClient().onShowFileChooser(view, results::add, chooserParams()));
            assertEquals(1, results.size());
            assertNull(results.get(0));
        }
    }

    @Test public void unavailableSavePickerCleansUpAndAllowsRetry() {
        try (ActivityController<NoPickerActivity> unavailable = Robolectric.buildActivity(NoPickerActivity.class).setup()) {
            MainActivity target = unavailable.get();
            assertTrue(target.new AndroidFiles().save("scene.json", "e30=", "application/json"));
            shadowOf(Looper.getMainLooper()).idle();
            assertEquals("No se pudo abrir Guardar como", ShadowToast.getTextOfLatestToast());
            assertTrue(target.new AndroidFiles().save("retry.json", "e30=", "application/json"));
        }
    }
}

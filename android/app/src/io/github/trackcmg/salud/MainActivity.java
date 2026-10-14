package io.github.trackcmg.salud;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.health.connect.HealthConnectManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.EditText;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int HEALTH_REQUEST = 10, EXPORT_REQUEST = 11, BACKGROUND_REQUEST = 12;
    private static final int BG = Color.rgb(12, 19, 31), CARD = Color.rgb(23, 34, 51);
    private static final int WHITE = Color.rgb(237, 242, 249), MUTED = Color.rgb(165, 181, 202);
    private static final int MINT = Color.rgb(100, 221, 192);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService fileExecutor = Executors.newSingleThreadExecutor();
    private TextView status, permissions;
    private LinearLayout results;
    private Button allowButton, readButton, exportButton;
    private HealthReader reader;
    private JSONObject lastResult;
    private byte[] pendingExport;
    private boolean scanning = false;
    private boolean sendAfterScan = false;
    private TextView connectionStatus;
    private EditText pairingCode;
    private int generation = 0;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return insets;
        });
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(26), dp(20), dp(28));
        scroll.setFillViewport(true);
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
        setContentView(root);

        addText(content, "TRACKCMG / SALUD", 13, MINT, true);
        addText(content, "Tus datos. Sin intermediarios.", 28, WHITE, true);
        addText(content, "0.2.0 · Conexión privada · Android 14 o superior", 13, MUTED, false);
        LinearLayout connection=card(content);
        addText(connection,"Conectar con tu dashboard",18,WHITE,true);
        addText(connection,"En trackcmg.github.io → Salud, genera un código de vinculación y escríbelo aquí. "
            + "Solo se envía salud a tu Drive privado, nunca las finanzas.",14,MUTED,false);
        connectionStatus=addText(connection,"",14,MINT,false);
        pairingCode=new EditText(this);
        pairingCode.setSingleLine(true);pairingCode.setTextColor(WHITE);pairingCode.setHintTextColor(MUTED);
        pairingCode.setHint("Código de 12 caracteres");
        pairingCode.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        pairingCode.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(12)});
        connection.addView(pairingCode,new LinearLayout.LayoutParams(-1,dp(52)));
        button(connection,"Vincular este móvil",this::pairDevice);
        button(connection,"Activar sincronización automática",this::enableAutomatic);
        button(connection,"Sincronizar ahora",()->{sendAfterScan=true;startScan();});
        button(connection,"Pausar sincronización automática",()->{SyncJob.cancel(this);refreshConnection();});
        button(connection,"Desconectar en este móvil",()->{
            new AlertDialog.Builder(this).setTitle("Desconectar este móvil")
                .setMessage("Se detendrán los envíos y se borrará la credencial del móvil. Tus datos de salud en Drive no se borran. "
                    + "También puedes revocar el acceso desde Salud en la web.")
                .setPositiveButton("Desconectar",(d,w)->{SyncJob.cancel(this);new DeviceStore(this).clear();refreshConnection();})
                .setNegativeButton("Cancelar",null).show();
        });
        LinearLayout intro = card(content);
        addText(intro, "Primero, comprobar la conexión", 18, WHITE, true);
        addText(intro, "1. Abre Mi Fitness y sincroniza la pulsera.\n"
            + "2. Permite lectura de los datos que quieras.\n"
            + "3. Comprueba qué ha llegado a Health Connect.", 16, MUTED, false);
        permissions = addText(intro, "", 14, MINT, false);
        allowButton = button(intro, "1 · Dar acceso a Health Connect", this::askPermissions);
        readButton = button(intro, "2 · Comprobar últimos 7 días", this::startScan);
        button(intro, "Abrir ajustes de Health Connect", this::openHealthSettings);

        status = addText(content, "Aún no se han leído datos.", 16, WHITE, true);
        results = new LinearLayout(this);
        results.setOrientation(LinearLayout.VERTICAL);
        content.addView(results);
        exportButton = button(content, "3 · Guardar JSON de la prueba", this::export);
        exportButton.setEnabled(false);
        addText(content, "La sincronización envía únicamente salud al backend privado de TrackCMG. Android decide cuándo "
            + "ejecutar los trabajos; no es una hora exacta. Mi Fitness debe seguir enviando datos a Health Connect. "
            + "Los datos ausentes no se convierten en cero. No publiques las copias JSON.", 13, MUTED, false);
        button(content, "Privacidad y permisos", () -> startActivity(new Intent(this, PrivacyActivity.class)));
        updatePermissions();
        refreshConnection();
    }
    @Override public void onResume() { super.onResume(); if (permissions != null) {updatePermissions();refreshConnection();} }
    @Override public void onStop() {
        super.onStop();
        if (scanning) cancelScan("Lectura pausada al salir de la app. Vuelve a comprobar para terminar.");
    }
    @Override public void onDestroy() {
        if (reader != null) reader.close();
        handler.removeCallbacksAndMessages(null);
        fileExecutor.shutdown();
        lastResult = null;
        pendingExport = null;
        super.onDestroy();
    }

    private Set<String> requestedPermissions() {
        Set<String> requested = new LinkedHashSet<>();
        for (HealthTypes.Type type : HealthTypes.ALL) requested.add(type.permission);
        return requested;
    }
    private void updatePermissions() {
        Set<String> requested = requestedPermissions();
        long granted = requested.stream().filter(p -> checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED).count();
        permissions.setText(granted + " de " + requested.size() + " permisos concedidos. Puedes conceder solo algunos.");
    }
    private void askPermissions() {
        Set<String> missing = requestedPermissions();
        missing.removeIf(p -> checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED);
        if (missing.isEmpty()) { toast("Los permisos de lectura ya están concedidos."); return; }
        new AlertDialog.Builder(this).setTitle("Solo lectura, en tu móvil")
            .setMessage("Se solicitarán permisos de actividad, sueño y medidas corporales. "
                + "Puedes elegir cuáles permites. Esta prueba no modifica nada ni envía datos.")
            .setPositiveButton("Continuar", (dialog, which) -> {
                try { requestPermissions(missing.toArray(new String[0]), HEALTH_REQUEST); }
                catch (Exception error) { status.setText("No se pudo abrir la petición. Usa los ajustes de Health Connect."); }
            }).setNegativeButton("Cancelar", null).show();
    }
    @Override public void onRequestPermissionsResult(int code, String[] names, int[] grants) {
        super.onRequestPermissionsResult(code, names, grants);
        if (code == HEALTH_REQUEST) {
            updatePermissions();
            status.setText("Permisos revisados. Pulsa «Comprobar últimos 7 días».");
        }
        if(code==BACKGROUND_REQUEST){
            if(checkSelfPermission(SyncConfig.BACKGROUND)==PackageManager.PERMISSION_GRANTED)activateSchedule();
            else toast("Sin permiso de segundo plano: puedes usar «Sincronizar ahora».");
        }
    }
    private void openHealthSettings() {
        Intent intent = new Intent(HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS)
            .putExtra(Intent.EXTRA_PACKAGE_NAME, getPackageName());
        try { startActivity(intent); }
        catch (Exception error) {
            try { startActivity(new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS")); }
            catch (Exception ignored) { toast("Busca Health Connect o Salud conectada en Ajustes."); }
        }
    }
    private void startScan() {
        if (scanning) return;
        boolean anyGranted = requestedPermissions().stream()
            .anyMatch(p -> checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED);
        if (!anyGranted) { status.setText("Primero concede al menos un permiso de lectura."); return; }
        if(!SyncJob.RUNNING.compareAndSet(false,true)){toast("Ya hay una lectura en curso. Espera a que termine.");return;}
        if (reader != null) reader.close();
        lastResult = null;
        results.removeAllViews();
        exportButton.setEnabled(false);
        setScanning(true);
        int run = ++generation;
        reader = new HealthReader(this);
        reader.scan(new HealthReader.Listener() {
            @Override public void progress(String label) {
                runOnUiThread(() -> { if (generation == run) status.setText("Leyendo: " + label + "…"); });
            }
            @Override public void failed(String message) {
                runOnUiThread(() -> { if (generation == run) cancelScan("No se pudo terminar: " + message); });
            }
            @Override public void complete(JSONObject result) {
                runOnUiThread(() -> {
                    if (generation != run || isFinishing() || isDestroyed()) return;
                    setScanning(false);
                    lastResult = result;
                    renderResult(result);
                    exportButton.setEnabled(true);
                    if(sendAfterScan){sendAfterScan=false;upload(result);}
                });
            }
        });
        handler.postDelayed(() -> {
            if (generation == run && scanning) cancelScan("Health Connect ha tardado más de 120 segundos. "
                + "Comprueba que Mi Fitness ha terminado de sincronizar y vuelve a intentarlo.");
        }, 120000);
    }
    private void setScanning(boolean busy) {
        scanning = busy;
        if(!busy)SyncJob.RUNNING.set(false);
        readButton.setEnabled(!busy);
        allowButton.setEnabled(!busy);
        getWindow().getDecorView().setKeepScreenOn(busy);
    }
    private void cancelScan(String message) {
        generation++;
        if (reader != null) reader.close();
        setScanning(false);
        sendAfterScan=false;
        status.setText(message);
        exportButton.setEnabled(lastResult != null);
    }
    private void renderResult(JSONObject result) {
        boolean partial = result.optBoolean("hasErrors") || result.optBoolean("truncated");
        int count = result.optInt("totalRecords");
        status.setText((partial ? "Lectura parcial · " : "Lectura terminada · ")
            + result.optInt("populatedTypes") + " tipos con datos · " + count + " registros");
        if (count == 0) {
            LinearLayout help = card(results);
            addText(help, "Todavía no hay datos legibles", 18, WHITE, true);
            addText(help, "No significa que tengas cero pasos o cero horas de sueño. "
                + "Comprueba en Health Connect que Mi Fitness tiene permiso de escritura "
                + "y que hay registros recientes. Después abre Mi Fitness para sincronizar la pulsera.", 15, MUTED, false);
        }
        JSONArray buckets = result.optJSONArray("types");
        Set<String> allSources = new TreeSet<>();
        for (int i = 0; i < buckets.length(); i++) {
            JSONObject bucket = buckets.optJSONObject(i);
            JSONArray sourceArray = bucket.optJSONArray("sources");
            if (sourceArray != null) for (int j = 0; j < sourceArray.length(); j++) allSources.add(sourceArray.optString(j));
            LinearLayout row = card(results);
            addText(row, bucket.optString("label"), 17, WHITE, true);
            String state = bucket.optString("status");
            String description;
            int color = MUTED;
            if (state.equals("permission_denied")) description = "Sin permiso de lectura";
            else if (state.equals("ok")) {
                int n = bucket.optInt("count");
                description = n == 0 ? "Sin registros en este periodo" : n + " registros disponibles";
                if (n > 0) color = MINT;
            } else if (state.equals("truncated")) description = "Muchos datos: muestra parcial de " + bucket.optInt("count") + " registros";
            else description = "Error de lectura · " + bucket.optString("error", state);
            addText(row, description, 14, color, false);
            if (sourceArray != null && sourceArray.length() > 0)
                addText(row, "Origen: " + String.join(", ", jsonStrings(sourceArray)), 12, MUTED, false);
        }
        if (!allSources.isEmpty()) addText(results,
            "Se conservan las fuentes separadas; no se suman los pasos del móvil y de la pulsera. "
                + "La siguiente fase seleccionará las fuentes correctas para el dashboard.", 13, MUTED, false);
    }
    private Set<String> jsonStrings(JSONArray array) {
        Set<String> strings = new TreeSet<>();
        for (int i = 0; i < array.length(); i++) strings.add(array.optString(i));
        return strings;
    }
    private void export() {
        if (lastResult == null) return;
        pendingExport = lastResult.toString().getBytes(StandardCharsets.UTF_8);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json").putExtra(Intent.EXTRA_TITLE, "trackcmg-salud-prueba-" + LocalDate.now() + ".json");
        try { startActivityForResult(intent, EXPORT_REQUEST); }
        catch (Exception error) { pendingExport = null; toast("No se pudo abrir el selector de archivos."); }
    }
    @Override public void onActivityResult(int code, int resultCode, Intent data) {
        super.onActivityResult(code, resultCode, data);
        if (code != EXPORT_REQUEST) return;
        byte[] bytes = pendingExport;
        pendingExport = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
        Uri uri = data.getData();
        fileExecutor.execute(() -> {
            try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new java.io.IOException("No se pudo abrir el archivo.");
                output.write(bytes);
                output.flush();
                runOnUiThread(() -> toast("JSON guardado donde has elegido."));
            } catch (Exception error) {
                runOnUiThread(() -> toast("No se pudo guardar. Vuelve a intentarlo."));
            }
        });
    }
    private LinearLayout card(LinearLayout parent) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(CARD);
        shape.setCornerRadius(dp(18));
        box.setBackground(shape);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(12);
        parent.addView(box, params);
        return box;
    }
    private TextView addText(LinearLayout parent, String label, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setLineSpacing(dp(3), 1);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(10);
        parent.addView(view, params);
        return view;
    }
    private Button button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(14);
        button.setAllCaps(false);
        button.setMinHeight(dp(52));
        button.setTextColor(BG);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(MINT));
        button.setOnClickListener(v -> action.run());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(4);
        params.bottomMargin = dp(5);
        parent.addView(button, params);
        return button;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(String message) { if (!isDestroyed()) Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    private void refreshConnection(){
        if(connectionStatus==null)return;
        DeviceStore store=new DeviceStore(this);
        String text=store.connected()?"Móvil vinculado · "+(store.automatic()?"automática activada":"automática pausada"):"Sin vincular";
        if(!store.lastSuccess().isEmpty())text+="\nÚltimo envío correcto: "+store.lastSuccess();
        if(!store.lastError().isEmpty())text+="\nÚltimo aviso: "+store.lastError();
        connectionStatus.setText(text);
    }
    private void pairDevice(){
        String code=pairingCode.getText().toString().trim().toLowerCase(java.util.Locale.ROOT);
        if(!code.matches("[a-f0-9]{12}")){toast("Introduce el código de 12 caracteres de Salud en tu web.");return;}
        new AlertDialog.Builder(this).setTitle("Conectar con TrackCMG")
            .setMessage("Esta versión sí usa Internet. Tu móvil podrá enviar actividad, sueño, pulso y otros datos "
                + "que autorices en Health Connect a tu backend de TrackCMG y a un archivo privado en tu Google Drive. "
                + "No accede a las finanzas ni modifica Health Connect. La conexión se puede revocar desde la web.")
            .setPositiveButton("Vincular",(dialog,which)->{
                connectionStatus.setText("Vinculando…");
                fileExecutor.execute(()->{
                    try {
                        JSONObject response=HealthTransport.post(new JSONObject().put("action","healthPairDevice").put("code",code));
                        JSONObject credential=new JSONObject().put("deviceId",response.getString("deviceId")).put("deviceToken",response.getString("deviceToken"));
                        new DeviceStore(this).save(credential);
                        runOnUiThread(()->{pairingCode.setText("");refreshConnection();toast("Móvil vinculado. Activa la automática y haz el primer envío.");});
                    }catch(Exception error){new DeviceStore(this).error(error.getMessage());runOnUiThread(this::refreshConnection);}
                });
            }).setNegativeButton("Cancelar",null).show();
    }
    private void enableAutomatic(){
        if(!new DeviceStore(this).connected()){toast("Vincula primero el móvil con el código de la web.");return;}
        if(!SyncJob.supported()){toast("Esta versión de Android no permite lectura de salud en segundo plano. Usa el envío manual.");return;}
        if(checkSelfPermission(SyncConfig.BACKGROUND)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{SyncConfig.BACKGROUND},BACKGROUND_REQUEST);return;
        }
        activateSchedule();
    }
    private void activateSchedule(){
        try{SyncJob.schedule(this);refreshConnection();toast("Automática activada: Android intentará sincronizar aproximadamente cada 2 horas.");}
        catch(Exception error){toast(error.getMessage());}
    }
    private void upload(JSONObject result){
        DeviceStore store=new DeviceStore(this);
        if(!store.connected()){toast("Lectura terminada, pero falta vincular el móvil.");return;}
        connectionStatus.setText("Enviando salud a tu Drive privado…");
        fileExecutor.execute(()->{
            try {
                JSONObject credential=store.load();
                HealthTransport.post(new JSONObject().put("action","healthUpload").put("deviceId",credential.getString("deviceId"))
                    .put("deviceToken",credential.getString("deviceToken")).put("snapshot",result));
                store.success();runOnUiThread(()->{refreshConnection();toast("Salud sincronizada con TrackCMG.");});
            }catch(Exception error){
                if("unauthorized_device".equals(error.getMessage())){SyncJob.cancel(this);store.clear();}
                store.error(error.getMessage());runOnUiThread(this::refreshConnection);
            }
        });
    }
}

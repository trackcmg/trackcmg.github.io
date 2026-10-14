package io.github.trackcmg.salud;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.Record;
import android.os.OutcomeReceiver;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** One foreground scan. Errors/denied permissions are separate from absent measurements. */
public final class HealthReader implements AutoCloseable {
    public interface Listener {
        void progress(String label);
        void complete(JSONObject result);
        void failed(String message);
    }
    private static final int MAX_RECORDS_PER_TYPE = 20000;
    private final Context context;
    private final HealthConnectManager manager;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private final JSONArray types = new JSONArray();
    private final ScanWindow window = ScanWindow.lastSevenDays(Instant.now(), ZoneId.systemDefault());
    private Listener listener;
    private int index = 0;
    private int total = 0;
    private int populated = 0;
    private boolean hasErrors = false;
    private boolean truncated = false;

    public HealthReader(Context context) {
        this.context = context.getApplicationContext();
        manager = this.context.getSystemService(HealthConnectManager.class);
    }
    public void scan(Listener listener) {
        this.listener = listener;
        if (manager == null) { listener.failed("Health Connect no está disponible en este móvil."); return; }
        executor.execute(this::next);
    }
    public void cancel() { cancelled.set(true); }
    @Override public void close() { cancel(); executor.shutdown(); }

    private void next() {
        if (cancelled.get()) return;
        if (index == HealthTypes.ALL.size()) { finish(); return; }
        HealthTypes.Type type = HealthTypes.ALL.get(index++);
        listener.progress(type.label);
        try {
            JSONObject bucket = new JSONObject().put("type", type.key).put("label", type.label)
                .put("permission", type.permission).put("records", new JSONArray());
            types.put(bucket);
            if (context.checkSelfPermission(type.permission) != PackageManager.PERMISSION_GRANTED) {
                bucket.put("status", "permission_denied").put("count", 0);
                next();
                return;
            }
            read(type.recordClass, bucket, -1L, new HashSet<>(), new TreeSet<>());
        } catch (Exception error) { abort(error); }
    }
    private <T extends Record> void read(Class<T> recordClass, JSONObject bucket,
            long token, Set<String> seen, Set<String> sources) {
        if (cancelled.get()) return;
        try {
            ReadRecordsRequestUsingFilters.Builder<T> builder =
                new ReadRecordsRequestUsingFilters.Builder<>(recordClass)
                    .setTimeRangeFilter(new TimeInstantRangeFilter.Builder()
                        .setStartTime(window.start).setEndTime(window.end).build())
                    .setPageSize(500);
            if (token >= 0) builder.setPageToken(token);
            manager.readRecords(builder.build(), executor,
                new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
                    @Override public void onResult(ReadRecordsResponse<T> response) {
                        if (cancelled.get()) return;
                        try {
                            JSONArray records = bucket.getJSONArray("records");
                            boolean limitReached = false;
                            for (T record : response.getRecords()) {
                                if (records.length() >= MAX_RECORDS_PER_TYPE) { limitReached = true; break; }
                                String id = record.getMetadata().getId();
                                if (!seen.add(id)) continue;
                                JSONObject encoded = RecordCodec.encode(record);
                                records.put(encoded);
                                sources.add(encoded.getString("source"));
                            }
                            long nextToken = response.getNextPageToken();
                            if (!limitReached && nextToken >= 0 && nextToken != token) {
                                read(recordClass, bucket, nextToken, seen, sources);
                            } else {
                                boolean incomplete = limitReached || nextToken >= 0;
                                bucket.put("status", incomplete ? "truncated" : "ok")
                                    .put("count", records.length()).put("sources", new JSONArray(sources));
                                truncated |= incomplete;
                                total += records.length();
                                if (records.length() > 0) populated++;
                                next();
                            }
                        } catch (Exception error) { bucketError(bucket, "serialization_error", error); }
                    }
                    @Override public void onError(HealthConnectException error) {
                        bucketError(bucket, "read_error_" + error.getErrorCode(), error);
                    }
                });
        } catch (Exception error) { bucketError(bucket, "read_error", error); }
    }
    private void bucketError(JSONObject bucket, String code, Exception error) {
        if (cancelled.get()) return;
        hasErrors = true;
        try {
            JSONArray records = bucket.getJSONArray("records");
            Set<String> sources = new TreeSet<>();
            for (int i = 0; i < records.length(); i++) sources.add(records.getJSONObject(i).getString("source"));
            total += records.length();
            if (records.length() > 0) populated++;
            bucket.put("status", code).put("error", safeMessage(error))
                .put("count", records.length()).put("sources", new JSONArray(sources));
            next();
        } catch (JSONException nested) { abort(nested); }
    }
    private void finish() {
        if (cancelled.get()) return;
        try {
            JSONObject result = new JSONObject()
                .put("format", "trackcmg-health-probe").put("schemaVersion", 1)
                .put("appVersion", "0.2.0").put("generatedAt", Instant.now().toString())
                .put("timeZone", window.zone.toString()).put("start", window.start.toString())
                .put("end", window.end.toString()).put("totalRecords", total)
                .put("populatedTypes", populated).put("hasErrors", hasErrors)
                .put("truncated", truncated).put("types", types)
                .put("notes", "Registros originales por fuente; NO sumar fuentes sin deduplicar. "
                    + "La falta de permiso o de registros no significa un valor cero. "
                    + "Archivo de diagnóstico: no importar como copia del dashboard.");
            new DailyAggregates(manager,executor,window,cancelled).collect(types, aggregates -> {
                try {result.put("dailyAggregates",aggregates);listener.complete(result);}
                catch(JSONException error){abort(error);}
            });
        } catch (JSONException error) { abort(error); }
    }
    private void abort(Exception error) {
        if (!cancelled.getAndSet(true)) listener.failed(safeMessage(error));
    }
    private static String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null ? error.getClass().getSimpleName() : message;
    }
}

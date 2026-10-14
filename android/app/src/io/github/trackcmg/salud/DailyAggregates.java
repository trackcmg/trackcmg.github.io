package io.github.trackcmg.salud;

import android.health.connect.*;
import android.health.connect.datatypes.*;
import android.health.connect.datatypes.units.*;
import android.os.OutcomeReceiver;
import org.json.*;
import java.time.Period;
import java.util.*;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Function;

/** Native, daily totals PER SOURCE, never a naive sum of overlapping raw intervals. */
public final class DailyAggregates {
    private final HealthConnectManager manager;
    private final Executor executor;
    private final ScanWindow window;
    private final AtomicBoolean cancelled;
    private final List<Runnable> tasks = new ArrayList<>();
    private final JSONArray results = new JSONArray();
    private Consumer<JSONArray> done;
    private int index;
    public DailyAggregates(HealthConnectManager manager, Executor executor, ScanWindow window, AtomicBoolean cancelled) {
        this.manager=manager;this.executor=executor;this.window=window;this.cancelled=cancelled;
    }
    public void collect(JSONArray types, Consumer<JSONArray> done) throws JSONException {
        this.done=done;
        for(int i=0;i<types.length();i++) {
            JSONObject bucket=types.getJSONObject(i);
            if(!bucket.optString("status").equals("ok"))continue;
            String type=bucket.getString("type");
            Set<String> sources=new TreeSet<>();
            JSONArray records=bucket.getJSONArray("records");
            for(int j=0;j<records.length();j++)sources.add(records.getJSONObject(j).getString("source"));
            for(String source:sources) {
                switch(type) {
                    case "steps": tasks.add(()->query(type,source,StepsRecord.STEPS_COUNT_TOTAL,v->v.doubleValue())); break;
                    case "distance": tasks.add(()->query(type,source,DistanceRecord.DISTANCE_TOTAL,v->v.getInMeters())); break;
                    case "activeCalories": tasks.add(()->query(type,source,ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,v->v.getInCalories()/1000.0)); break;
                    case "totalCalories": tasks.add(()->query(type,source,TotalCaloriesBurnedRecord.ENERGY_TOTAL,v->v.getInCalories()/1000.0)); break;
                    case "elevation": tasks.add(()->query(type,source,ElevationGainedRecord.ELEVATION_GAINED_TOTAL,v->v.getInMeters())); break;
                    case "floors": tasks.add(()->query(type,source,FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL,v->v)); break;
                }
            }
        }
        next();
    }
    private void next() {
        if(cancelled.get())return;
        if(index==tasks.size())done.accept(results);
        else tasks.get(index++).run();
    }
    private <T> void query(String type, String source, AggregationType<T> aggregation, Function<T,Double> convert) {
        try {
            AggregateRecordsRequest<T> request=new AggregateRecordsRequest.Builder<T>(
                new LocalTimeRangeFilter.Builder().setStartTime(window.start.atZone(window.zone).toLocalDateTime())
                    .setEndTime(window.end.atZone(window.zone).toLocalDateTime()).build())
                .addAggregationType(aggregation).addDataOriginsFilter(new DataOrigin.Builder().setPackageName(source).build()).build();
            manager.aggregateGroupByPeriod(request,Period.ofDays(1),executor,
                new OutcomeReceiver<List<AggregateRecordsGroupedByPeriodResponse<T>>,HealthConnectException>() {
                    @Override public void onResult(List<AggregateRecordsGroupedByPeriodResponse<T>> response) {
                        if(cancelled.get())return;
                        try {
                            JSONArray days=new JSONArray();
                            for(AggregateRecordsGroupedByPeriodResponse<T> day:response) {
                                T value=day.get(aggregation);
                                days.put(new JSONObject().put("date",day.getStartTime().toLocalDate().toString())
                                    .put("value",value==null?JSONObject.NULL:convert.apply(value)));
                            }
                            results.put(new JSONObject().put("type",type).put("source",source).put("status","ok").put("days",days));
                        } catch(Exception error) { recordError(type,source); }
                        next();
                    }
                    @Override public void onError(HealthConnectException error) {if(!cancelled.get()){recordError(type,source);next();}}
                });
        } catch(Exception error) {recordError(type,source);next();}
    }
    private void recordError(String type,String source) {
        try {results.put(new JSONObject().put("type",type).put("source",source).put("status","error").put("days",new JSONArray()));}
        catch(JSONException ignored) {}
    }
}

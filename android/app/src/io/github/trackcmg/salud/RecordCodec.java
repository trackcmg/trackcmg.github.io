package io.github.trackcmg.salud;

import android.health.connect.datatypes.*;
import android.health.connect.datatypes.Record;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Explicit units, original instants, IDs and sources. No cross-source sums or fake zeros. */
public final class RecordCodec {
    public static JSONObject encode(Record record) throws JSONException {
        JSONObject json = new JSONObject();
        Metadata meta = record.getMetadata();
        json.put("id", meta.getId());
        json.put("source", meta.getDataOrigin().getPackageName());
        json.put("lastModified", meta.getLastModifiedTime().toString());
        json.put("recordingMethod", meta.getRecordingMethod());
        if (meta.getClientRecordId() != null) json.put("clientRecordId", meta.getClientRecordId());
        json.put("clientRecordVersion", meta.getClientRecordVersion());
        if (record instanceof IntervalRecord interval) {
            json.put("start", interval.getStartTime().toString());
            json.put("end", interval.getEndTime().toString());
            if (interval.getStartZoneOffset() != null) json.put("startOffset", interval.getStartZoneOffset().toString());
            if (interval.getEndZoneOffset() != null) json.put("endOffset", interval.getEndZoneOffset().toString());
        } else if (record instanceof InstantRecord instant) {
            json.put("time", instant.getTime().toString());
            if (instant.getZoneOffset() != null) json.put("offset", instant.getZoneOffset().toString());
        }
        if (record instanceof StepsRecord r) value(json, r.getCount(), "steps");
        else if (record instanceof DistanceRecord r) value(json, r.getDistance().getInMeters(), "m");
        else if (record instanceof ActiveCaloriesBurnedRecord r) value(json, r.getEnergy().getInCalories() / 1000.0, "kcal");
        else if (record instanceof TotalCaloriesBurnedRecord r) value(json, r.getEnergy().getInCalories() / 1000.0, "kcal");
        else if (record instanceof ElevationGainedRecord r) value(json, r.getElevation().getInMeters(), "m");
        else if (record instanceof FloorsClimbedRecord r) value(json, r.getFloors(), "floors");
        else if (record instanceof RestingHeartRateRecord r) value(json, r.getBeatsPerMinute(), "bpm");
        else if (record instanceof HeartRateVariabilityRmssdRecord r) value(json, r.getHeartRateVariabilityMillis(), "ms");
        else if (record instanceof RespiratoryRateRecord r) value(json, r.getRate(), "breaths/min");
        else if (record instanceof OxygenSaturationRecord r) value(json, r.getPercentage().getValue(), "%");
        else if (record instanceof WeightRecord r) value(json, r.getWeight().getInGrams() / 1000.0, "kg");
        else if (record instanceof HeightRecord r) value(json, r.getHeight().getInMeters(), "m");
        else if (record instanceof BodyFatRecord r) value(json, r.getPercentage().getValue(), "%");
        else if (record instanceof BodyTemperatureRecord r) value(json, r.getTemperature().getInCelsius(), "C");
        else if (record instanceof BasalBodyTemperatureRecord r) value(json, r.getTemperature().getInCelsius(), "C");
        else if (record instanceof Vo2MaxRecord r) {
            value(json, r.getVo2MillilitersPerMinuteKilogram(), "ml/kg/min");
            json.put("measurementMethod", r.getMeasurementMethod());
        } else if (record instanceof HeartRateRecord r) {
            JSONArray samples = new JSONArray();
            for (HeartRateRecord.HeartRateSample s : r.getSamples()) samples.put(sample(s.getTime().toString(), s.getBeatsPerMinute()));
            json.put("unit", "bpm").put("samples", samples);
        } else if (record instanceof SpeedRecord r) {
            JSONArray samples = new JSONArray();
            for (SpeedRecord.SpeedRecordSample s : r.getSamples()) samples.put(sample(s.getTime().toString(), s.getSpeed().getInMetersPerSecond()));
            json.put("unit", "m/s").put("samples", samples);
        } else if (record instanceof PowerRecord r) {
            JSONArray samples = new JSONArray();
            for (PowerRecord.PowerRecordSample s : r.getSamples()) samples.put(sample(s.getTime().toString(), s.getPower().getInWatts()));
            json.put("unit", "W").put("samples", samples);
        } else if (record instanceof StepsCadenceRecord r) {
            JSONArray samples = new JSONArray();
            for (StepsCadenceRecord.StepsCadenceRecordSample s : r.getSamples()) samples.put(sample(s.getTime().toString(), s.getRate()));
            json.put("unit", "steps/min").put("samples", samples);
        } else if (record instanceof CyclingPedalingCadenceRecord r) {
            JSONArray samples = new JSONArray();
            for (CyclingPedalingCadenceRecord.CyclingPedalingCadenceRecordSample s : r.getSamples()) samples.put(sample(s.getTime().toString(), s.getRevolutionsPerMinute()));
            json.put("unit", "rpm").put("samples", samples);
        } else if (record instanceof SleepSessionRecord r) {
            JSONArray stages = new JSONArray();
            for (SleepSessionRecord.Stage s : r.getStages()) stages.put(new JSONObject()
                .put("start", s.getStartTime().toString()).put("end", s.getEndTime().toString())
                .put("stageType", s.getType()));
            json.put("stages", stages);
        } else if (record instanceof ExerciseSessionRecord r) {
            json.put("exerciseType", r.getExerciseType());
            if (r.getTitle() != null) json.put("title", r.getTitle().toString());
            JSONArray segments = new JSONArray();
            for (ExerciseSegment s : r.getSegments()) segments.put(new JSONObject()
                .put("start", s.getStartTime().toString()).put("end", s.getEndTime().toString())
                .put("segmentType", s.getSegmentType()).put("repetitions", s.getRepetitionsCount()));
            json.put("segments", segments);
            // Deliberately don't request or export GPS exercise routes or private notes.
        } else throw new JSONException("Record type not supported: " + record.getClass().getSimpleName());
        return json;
    }
    private static void value(JSONObject json, double value, String unit) throws JSONException {
        json.put("value", value).put("unit", unit);
    }
    private static JSONObject sample(String time, double value) throws JSONException {
        return new JSONObject().put("time", time).put("value", value);
    }
    private RecordCodec() {}
}

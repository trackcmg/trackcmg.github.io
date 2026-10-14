package io.github.trackcmg.salud;

import android.health.connect.datatypes.*;
import android.health.connect.datatypes.Record;
import java.util.List;

/** Only band/activity metrics; no medical records, routes, nutrition or reproductive data. */
public final class HealthTypes {
    public static final class Type {
        public final String key, label, permission;
        public final Class<? extends Record> recordClass;
        Type(String key, String label, String permission, Class<? extends Record> recordClass) {
            this.key = key;
            this.label = label;
            this.permission = "android.permission.health.READ_" + permission;
            this.recordClass = recordClass;
        }
    }
    public static final List<Type> ALL = List.of(
        new Type("steps", "Pasos", "STEPS", StepsRecord.class),
        new Type("distance", "Distancia", "DISTANCE", DistanceRecord.class),
        new Type("activeCalories", "Calorías activas", "ACTIVE_CALORIES_BURNED", ActiveCaloriesBurnedRecord.class),
        new Type("totalCalories", "Calorías totales", "TOTAL_CALORIES_BURNED", TotalCaloriesBurnedRecord.class),
        new Type("sleep", "Sueño y fases", "SLEEP", SleepSessionRecord.class),
        new Type("heartRate", "Frecuencia cardíaca", "HEART_RATE", HeartRateRecord.class),
        new Type("restingHeartRate", "Pulso en reposo", "RESTING_HEART_RATE", RestingHeartRateRecord.class),
        new Type("oxygenSaturation", "Oxígeno en sangre (SpO₂)", "OXYGEN_SATURATION", OxygenSaturationRecord.class),
        new Type("exercise", "Entrenamientos", "EXERCISE", ExerciseSessionRecord.class),
        new Type("heartRateVariability", "Variabilidad cardíaca (HRV)", "HEART_RATE_VARIABILITY", HeartRateVariabilityRmssdRecord.class),
        new Type("respiratoryRate", "Frecuencia respiratoria", "RESPIRATORY_RATE", RespiratoryRateRecord.class),
        new Type("elevation", "Desnivel ascendido", "ELEVATION_GAINED", ElevationGainedRecord.class),
        new Type("floors", "Plantas subidas", "FLOORS_CLIMBED", FloorsClimbedRecord.class),
        new Type("weight", "Peso", "WEIGHT", WeightRecord.class),
        new Type("height", "Altura", "HEIGHT", HeightRecord.class),
        new Type("bodyFat", "Grasa corporal", "BODY_FAT", BodyFatRecord.class),
        new Type("bodyTemperature", "Temperatura corporal", "BODY_TEMPERATURE", BodyTemperatureRecord.class),
        new Type("basalTemperature", "Temperatura basal", "BASAL_BODY_TEMPERATURE", BasalBodyTemperatureRecord.class),
        new Type("vo2Max", "VO₂ máximo", "VO2_MAX", Vo2MaxRecord.class),
        new Type("speed", "Velocidad", "SPEED", SpeedRecord.class),
        new Type("power", "Potencia", "POWER", PowerRecord.class),
        new Type("cyclingCadence", "Cadencia de ciclismo", "EXERCISE", CyclingPedalingCadenceRecord.class),
        new Type("stepsCadence", "Cadencia de pasos", "STEPS", StepsCadenceRecord.class)
    );
    private HealthTypes() {}
}

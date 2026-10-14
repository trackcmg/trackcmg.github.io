package io.github.trackcmg.salud;

import android.health.connect.HealthPermissions;
import java.util.HashSet;
import java.util.Set;

public final class HealthTypesTest {
    public static void main(String[] args) throws Exception {
        Set<String> keys = new HashSet<>();
        Set<Class<?>> classes = new HashSet<>();
        Set<String> permissions = new HashSet<>();
        for (HealthTypes.Type type : HealthTypes.ALL) {
            if (!keys.add(type.key)) throw new AssertionError("Duplicate key: " + type.key);
            if (!classes.add(type.recordClass)) throw new AssertionError("Duplicate record class: " + type.recordClass);
            String field = type.permission.substring("android.permission.health.".length());
            Object frameworkPermission = HealthPermissions.class.getField(field).get(null);
            if (!type.permission.equals(frameworkPermission)) throw new AssertionError("Wrong framework permission: " + type.permission);
            permissions.add(type.permission);
        }
        if (keys.size() != 23 || permissions.size() != 21) throw new AssertionError("Unexpected data or permission coverage");
        if (!HealthTypes.ALL.stream().anyMatch(t -> t.key.equals("cyclingCadence") && t.permission.endsWith(".READ_EXERCISE")))
            throw new AssertionError("Cadence uses EXERCISE, not a nonexistent CADENCE permission");
        System.out.println("HealthTypes: 23 unique record types, 21 valid read permissions");
    }
}

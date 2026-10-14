package io.github.trackcmg.salud;

import java.time.Instant;
import java.time.ZoneId;

/** Calendar days in the phone's time zone, not seven multiples of 24h across DST. */
public final class ScanWindow {
    public final Instant start;
    public final Instant end;
    public final ZoneId zone;
    private ScanWindow(Instant start, Instant end, ZoneId zone) {
        this.start = start;
        this.end = end;
        this.zone = zone;
    }
    public static ScanWindow lastSevenDays(Instant now, ZoneId zone) {
        return new ScanWindow(now.atZone(zone).toLocalDate().minusDays(6)
            .atStartOfDay(zone).toInstant(), now, zone);
    }
}

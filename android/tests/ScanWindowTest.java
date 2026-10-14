package io.github.trackcmg.salud;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class ScanWindowTest {
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        ZoneId madrid = ZoneId.of("Europe/Madrid");
        Instant now = Instant.parse("2026-10-14T13:45:00Z");
        ScanWindow window = ScanWindow.lastSevenDays(now, madrid);
        check(window.start.equals(Instant.parse("2026-10-07T22:00:00Z")), "Include today and six previous calendar dates");
        check(window.end.equals(now), "Never read future records");
        check(window.zone.equals(madrid), "Keep local time zone");
        Instant spring = ZonedDateTime.parse("2026-03-31T12:00:00+02:00[Europe/Madrid]").toInstant();
        check(ScanWindow.lastSevenDays(spring, madrid).start.equals(Instant.parse("2026-03-24T23:00:00Z")), "DST spring uses calendar midnight");
        Instant autumn = ZonedDateTime.parse("2026-10-27T12:00:00+01:00[Europe/Madrid]").toInstant();
        check(ScanWindow.lastSevenDays(autumn, madrid).start.equals(Instant.parse("2026-10-20T22:00:00Z")), "DST autumn uses calendar midnight");
        check(ScanWindow.lastSevenDays(Instant.parse("2026-01-02T12:00:00Z"), ZoneId.of("UTC"))
            .start.equals(Instant.parse("2025-12-27T00:00:00Z")), "Cross year boundary");
        System.out.println("ScanWindow: 6 checks passed");
    }
}

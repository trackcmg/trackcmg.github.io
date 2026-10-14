package io.github.trackcmg.salud;

public final class SyncConfig {
    // One fixed HTTPS backend. No user-controlled hosts, finance sessions or OAuth secrets.
    public static final String ENDPOINT="https://script.google.com/macros/s/AKfycbyWUy-SpQFdJZnI1TWeL68pu5gdax4Tj6ZHg_pSY-R2HWzaHB4KDZo44se5vMdu_8xV/exec";
    public static final String BACKGROUND="android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND";
    public static final int JOB_ID=21206;
    private SyncConfig() {}
}

package io.github.trackcmg.salud;

import android.app.job.*;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ext.SdkExtensions;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native Android persisted job; approximate schedule, not an exact alarm. */
public final class SyncJob extends JobService {
    public static final AtomicBoolean RUNNING=new AtomicBoolean();
    private HealthReader reader;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean stopped;
    public static boolean supported(){return Build.VERSION.SDK_INT>=35 || SdkExtensions.getExtensionVersion(34)>=13;}
    public static void schedule(Context context) {
        new DeviceStore(context).automatic(true);
        int result=context.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(SyncConfig.JOB_ID,new ComponentName(context,SyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(2*60*60*1000L)
            .setBackoffCriteria(30*60*1000L,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
        if(result!=JobScheduler.RESULT_SUCCESS){new DeviceStore(context).automatic(false);throw new IllegalStateException("Android no ha permitido programar la sincronización.");}
    }
    public static void cancel(Context context){context.getSystemService(JobScheduler.class).cancel(SyncConfig.JOB_ID);new DeviceStore(context).automatic(false);}
    @Override public boolean onStartJob(JobParameters parameters) {
        DeviceStore store=new DeviceStore(this);
        if(!store.automatic() || !store.connected())return false;
        if(!supported() || checkSelfPermission(SyncConfig.BACKGROUND)!=PackageManager.PERMISSION_GRANTED){store.error("Falta permiso de lectura en segundo plano.");return false;}
        if(!RUNNING.compareAndSet(false,true))return false;
        stopped=false;reader=new HealthReader(this);
        reader.scan(new HealthReader.Listener(){
            public void progress(String label){}
            public void failed(String message){finish(parameters,false,message);}
            public void complete(JSONObject snapshot){
                new Thread(()->{
                    try {
                        if(stopped)return;
                        JSONObject credential=store.load();
                        if(credential==null)throw new Exception("Dispositivo desconectado.");
                        HealthTransport.post(new JSONObject().put("action","healthUpload")
                            .put("deviceId",credential.getString("deviceId")).put("deviceToken",credential.getString("deviceToken")).put("snapshot",snapshot));
                        store.success();finish(parameters,false,null);
                    }catch(Exception error){finish(parameters,true,error.getMessage());}
                },"health-upload").start();
            }
        });
        handler.postDelayed(()->{if(!stopped)finish(parameters,true,"La sincronización ha superado el tiempo de espera.");},150000);
        return true;
    }
    private synchronized void finish(JobParameters parameters,boolean retry,String error){
        if(stopped)return;stopped=true;
        handler.removeCallbacksAndMessages(null);
        if(reader!=null)reader.close();
        if("unauthorized_device".equals(error)){new DeviceStore(this).clear();cancel(this);retry=false;}
        if(error!=null)new DeviceStore(this).error(error);
        RUNNING.set(false);jobFinished(parameters,retry);
    }
    @Override public boolean onStopJob(JobParameters parameters){
        stopped=true;handler.removeCallbacksAndMessages(null);if(reader!=null)reader.close();RUNNING.set(false);return true;
    }
}

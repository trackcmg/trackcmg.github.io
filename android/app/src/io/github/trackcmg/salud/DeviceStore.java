package io.github.trackcmg.salud;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device credential encrypted with a non-exportable Android Keystore key. */
public final class DeviceStore {
    private static final String ALIAS="trackcmg.health.device";
    private final SharedPreferences prefs;
    public DeviceStore(Context context){prefs=context.getSharedPreferences("health_sync",Context.MODE_PRIVATE);}
    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    public void save(JSONObject credential) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        byte[] encrypted=cipher.doFinal(credential.toString().getBytes(StandardCharsets.UTF_8));
        if(!prefs.edit().putString("credential",Base64.encodeToString(encrypted,Base64.NO_WRAP))
            .putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).commit())throw new Exception("No se pudo guardar la conexión.");
    }
    public JSONObject load() throws Exception {
        String encrypted=prefs.getString("credential",null);if(encrypted==null)return null;
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(encrypted,Base64.NO_WRAP)),StandardCharsets.UTF_8));
    }
    public boolean connected(){try{return load()!=null;}catch(Exception error){return false;}}
    public void clear(){prefs.edit().remove("credential").remove("iv").putBoolean("automatic",false).apply();}
    public boolean automatic(){return prefs.getBoolean("automatic",false);}
    public void automatic(boolean value){prefs.edit().putBoolean("automatic",value).apply();}
    public void success(){prefs.edit().putString("lastSuccess",java.time.Instant.now().toString()).putString("lastError","").apply();}
    public void error(String message){prefs.edit().putString("lastError",message).apply();}
    public String lastSuccess(){return prefs.getString("lastSuccess","");}
    public String lastError(){return prefs.getString("lastError","");}
}

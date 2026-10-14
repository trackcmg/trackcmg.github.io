package io.github.trackcmg.salud;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public final class HealthTransport {
    public static JSONObject post(JSONObject body) throws Exception {
        byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
        if(bytes.length>4000000)throw new IOException("Demasiados datos para un envío. No se ha enviado nada.");
        URL url=new URL(SyncConfig.ENDPOINT);
        boolean post=true;
        for(int redirects=0;redirects<4;redirects++) {
            if(!url.getProtocol().equals("https") || !(url.getHost().equals("script.google.com") || url.getHost().equals("script.googleusercontent.com")))
                throw new IOException("Redirección bloqueada por seguridad.");
            HttpURLConnection connection=(HttpURLConnection)url.openConnection();
            try {
                connection.setConnectTimeout(20000);connection.setReadTimeout(30000);connection.setInstanceFollowRedirects(false);
                connection.setUseCaches(false);connection.setRequestProperty("Cache-Control","no-store");
                connection.setRequestMethod(post?"POST":"GET");
                if(post){
                    connection.setDoOutput(true);connection.setRequestProperty("Content-Type","text/plain; charset=utf-8");
                    connection.setFixedLengthStreamingMode(bytes.length);
                    try(OutputStream output=connection.getOutputStream()){output.write(bytes);}
                }
                int status=connection.getResponseCode();
                if(status==301 || status==302 || status==303){
                    String location=connection.getHeaderField("Location");
                    if(location==null)throw new IOException("Respuesta sin destino.");
                    url=new URL(url,location);post=false;continue;
                }
                if(status!=200)throw new IOException("El servidor no respondió correctamente ("+status+").");
                ByteArrayOutputStream result=new ByteArrayOutputStream();
                try(InputStream input=connection.getInputStream()){
                    byte[] buffer=new byte[4096];int n;
                    while((n=input.read(buffer))!=-1){result.write(buffer,0,n);if(result.size()>100000)throw new IOException("Respuesta demasiado grande.");}
                }
                JSONObject response;
                try{response=new JSONObject(result.toString(StandardCharsets.UTF_8));}
                catch(Exception invalid){throw new IOException("Respuesta inesperada: comprueba la versión del backend.");}
                if(!response.optBoolean("ok"))throw new IOException(response.optString("error","Error de sincronización"));
                return response;
            } finally {connection.disconnect();}
        }
        throw new IOException("Demasiadas redirecciones del servidor.");
    }
    private HealthTransport(){}
}

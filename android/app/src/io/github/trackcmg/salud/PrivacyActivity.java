package io.github.trackcmg.salud;

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

public final class PrivacyActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        TextView text = new TextView(this);
        text.setTextSize(17);
        text.setPadding(28, 60, 28, 64);
        text.setText("TrackCMG Salud · Privacidad\n\nVersión 0.2.0\n\n"
            + "Esta app personal comprueba qué datos puedes leer de Health Connect. "
            + "Solicita solo lectura de actividad, sueño, constantes y medidas corporales. "
            + "Puedes permitir únicamente los tipos de datos que quieras.\n\n"
            + "La versión 0.2.0 SÍ utiliza Internet, únicamente para vincular tu móvil y enviar salud "
            + "al backend de TrackCMG en Google Apps Script y a tu archivo privado en Google Drive. "
            + "Antes del primer envío tienes que vincular el móvil con un código de tu web. "
            + "No incluye publicidad ni analítica. "
            + "No escribe ni borra registros en Health Connect. No pide ubicación, rutas GPS, "
            + "contactos, archivos del teléfono ni datos médicos/reproductivos.\n\n"
            + "La lectura se limita a los últimos siete días y se conserva únicamente en memoria "
            + "durante cada lectura y envío. La sincronización automática es opcional, requiere permiso "
            + "de lectura en segundo plano y Android decide el momento de ejecución. Relee siete días "
            + "para actualizar datos tardíos sin duplicarlos. La app no crea mediciones que falten. "
            + "Guardar JSON abre el selector de Android; tú eliges dónde guardar esa copia. "
            + "Si eliges Drive, el archivo se enviará allí mediante el proveedor de archivos elegido.\n\n"
            + "El JSON contiene datos de salud y sus apps de origen. Compártelo solo si quieres "
            + "y nunca lo subas al repositorio público. No es una copia importable del dashboard.\n\n"
            + "La credencial del dispositivo se guarda cifrada mediante Android Keystore. Solo permite enviar "
            + "salud: no permite leer ni modificar las finanzas. Puedes pausar la automática, desconectar "
            + "el móvil o revocar su conexión desde la sección Salud de tu web. Los datos y la copia anterior "
            + "se conservan en archivos privados de tu Drive; no se publican en GitHub. "
            + "Puedes revocar los permisos en Health Connect o desinstalar la app. "
            + "Las copias exportadas y los archivos de salud en Drive se borran por separado donde los guardaste.\n\n"
            + "Los valores provienen de las apps conectadas: no se inventan métricas que "
            + "Mi Fitness no exporte. Esta herramienta no ofrece diagnósticos médicos.");
        scroll.addView(text);
        setContentView(scroll);
    }
}

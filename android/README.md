# TrackCMG Salud 0.2.0

App gratuita y personal para Android 14+, con lectura de Health Connect y conexión
opcional al backend privado de TrackCMG. Instalar esta versión sobre la 0.1.0 con
la misma firma conserva los permisos de lectura existentes. No hay suscripción.

## Activación en el móvil

1. En tu web, abre **Salud** y descarga el APK. Instálalo como actualización.
2. En **Salud → Vincular móvil**, confirma el alcance y genera un código. Tiene
   doce caracteres, caduca a los diez minutos y solo se puede usar una vez.
3. En la app Android, introduce el código y pulsa **Vincular este móvil**. Revisa
   el aviso de privacidad antes de confirmar.
4. Pulsa **Activar sincronización automática** y concede el permiso adicional
   de lectura de salud en segundo plano. Los permisos de las métricas son distintos.
5. Pulsa **Sincronizar ahora** para probar el primer envío. Después, en la web,
   pulsa **Actualizar**. No se considera comprobado el envío real hasta este paso.

La app programa un trabajo persistente cada dos horas aproximadamente, con red
disponible. Android, ahorro de batería y OriginOS pueden retrasarlo: no es una
alarma exacta ni una garantía de ejecución a una hora determinada. Si el móvil
no admite el permiso adicional, sigue funcionando el envío manual. En OriginOS,
si los envíos en segundo plano no llegan, revisa las restricciones de batería
de TrackCMG Salud y Mi Fitness, sin desactivar protecciones del sistema.

Mi Fitness debe seguir compartiendo los datos con Health Connect. La app no accede
directamente a la pulsera ni puede recuperar sueño u otras métricas que Xiaomi
no entregue. Esta integración no garantiza una exportación del historial anterior.

## Qué se envía y dónde

- Los registros legibles de los últimos siete días y los totales diarios nativos
  de Health Connect, separados por app de origen. No se suman pasos del teléfono
  y de la pulsera. Las métricas no concedidas o fallidas se identifican como tales.
- Actividad, sueño/fases, pulso, SpO₂, entrenamientos y las demás medidas compatibles
  que autorices. No se solicitan rutas GPS, contactos, datos reproductivos ni historias
  clínicas. No hay publicidad ni SDKs de analítica.
- El único destino programado es la URL HTTPS del backend de TrackCMG en Apps Script.
  No se envía una sesión financiera desde el móvil.
- El backend conserva los datos en un **archivo privado de salud separado**, por
  propietario autorizado, y mantiene la copia anterior. `dashboard_data.json`
  no se lee ni se escribe por las rutas de salud.
- El archivo conserva resúmenes diarios históricos y la última ventana de registros
  originales. La web solo recibe los resúmenes, no todas las muestras originales.
- No se guardan mediciones en el almacenamiento local del navegador ni en la caché
  del service worker: las lecturas de salud son POST autenticados sin caché.

## Credencial y revocación

La sesión habitual de la web genera el código de vinculación. Al usarlo, la app
recibe una credencial exclusivamente para **enviar salud**, cifrada con una clave
no exportable de Android Keystore. No puede leer salud ni leer/escribir finanzas.
El backend almacena solo su hash y revalida la allowlist del propietario al enviar.

En **Salud → Revocar acceso**, la web invalida la credencial del móvil. En el siguiente
intento rechazado, la app borra su credencial y detiene los trabajos. **Pausar** en la
app solo detiene la programación. **Desconectar en este móvil** borra la credencial
local; ninguno de esos botones borra las mediciones almacenadas en Drive.
Vincular otro móvil reemplaza la conexión anterior del mismo propietario.

## Números y ausencias

Los totales acumulables se obtienen con la API de agregados de Health Connect,
por día y origen. Pulso y oxígeno son medias de las muestras recibidas, no medidas
continuas ni diagnósticos. Sueño se atribuye al día de despertar y cuenta la unión
de fases identificadas como dormido; sin fases se conserva el intervalo en cama
sin llamarlo sueño. Una ausencia se muestra como **—**, nunca como un cero medido.
Un fallo o permiso revocado conserva los valores anteriores; una lectura completa
puede actualizar o retirar valores eliminados en Health Connect dentro de la ventana.

## Compilar y revisar

```powershell
.\tools\bootstrap.ps1
.\tools\test.ps1
.\tools\build.ps1
```

Herramientas oficiales aisladas en `.tools/`, sin instalación global. La firma
personal está en `.signing/`: nunca publicar esa carpeta ni su contraseña. El
código Android no incluye credenciales del backend. Para actualizar una instalación
existente hay que conservar la misma clave privada de firma; otra clave requiere
desinstalar la app anterior. La firma prueba integridad, no equivale a auditoría.

Verificación realizada: compilación, firma, tipos/permisos de Android, fechas/DST,
modelo diario, validación, reenvíos idempotentes, actualizaciones tardías, fuentes,
ausencias, autorización, códigos de un uso y revocación. La prueba 0.1.0 del usuario
leyó mediciones reales de su vivo. **La 0.2.0 necesita la primera prueba de envío en
ese móvil; no se ha probado su ejecución real en segundo plano ni en un emulador.**

## Revertir

Pausa/revoca la conexión. La web se revierte con el commit de esta función; en Apps
Script, vuelve a la versión 4 de la implementación si fuera necesario. Hay una copia
local del código anterior en `salud-android/backend/Code.before.gs`. Los archivos de
salud quedan separados y no alteran las finanzas. Desinstalar la app no borra esos
archivos de Drive ni los datos originales de Health Connect.

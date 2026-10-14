# Salud · integración personal Android

Solo TrackCMG. Los datos de salud y su copia anterior se guardan en archivos privados
de Drive distintos de `dashboard_data.json`. Las finanzas, medios y gimnasio no cambian
de esquema. No se publican mediciones ni credenciales en el repositorio.

La fuente Android está en `android/`; APK en `downloads/`. Instrucciones, permisos,
privacidad, limitaciones y pruebas pendientes en `android/README.md`.

El modelo puro `js/health-model.js` se comparte con la extensión de Apps Script en
`backend/Health.gs`. Las pruebas `node tests/health.cjs` cubren normalización, fuentes,
ausencias, reenvíos, correcciones y autorización con servicios simulados.

## Backend

La implementación existente se actualizó desde la versión 4, conservando URL,
propietario y acceso. El código original se conserva fuera del repositorio como
`trackcmg/salud-android/backend/Code.before.gs`. La única modificación a las rutas
originales es un despacho de acciones cuyo nombre empieza por `health`, antes de la
ruta financiera genérica, para impedir que una petición de salud escriba en ella.
La sesión web se verifica con las funciones existentes. Credenciales del móvil no
son sesiones web: solo sirven para `healthUpload`.

Los clientes web de salud envían `healthSession`, nunca `session_token`. Por tanto,
si se revierte el backend a una versión sin salud, la ruta financiera genérica
rechaza esas peticiones por falta de su sesión habitual, en vez de guardar datos
indefinidos. Esto permite revertir ambos componentes sin un orden peligroso.

- `healthCreatePair`: sesión web válida, código de 48 bits, diez minutos, un uso.
- `healthPairDevice`: consume el código y devuelve una credencial de dispositivo.
- `healthUpload`: credencial de dispositivo y propietario aún autorizado. Modelo
  validado, ventana móvil de siete días, rechaza snapshots antiguos respecto del último.
- `healthGet`: sesión web válida, solo resúmenes y estado del móvil, sin token/hash.
- `healthRevokeDevice`: sesión web válida, invalida conexión sin borrar mediciones.

No se añaden permisos OAuth, no se cambia la allowlist ni se abre acceso público a
los archivos. La URL del script ya era accesible públicamente: los datos siguen
protegidos por las comprobaciones de autenticación de cada acción.

Para revertir: revocar dispositivo desde Salud, revertir el commit web y seleccionar
la versión 4 de la misma implementación de Apps Script. Los archivos de salud se
pueden conservar para recuperar el histórico; no se borran automáticamente.

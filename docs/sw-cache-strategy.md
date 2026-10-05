# Caché y actualización de la app

La estrategia vigente está documentada en [app-updates.md](app-updates.md).

GitHub Pages incorpora automáticamente el commit publicado en el service worker y el HTML. Cada nuevo despliegue utiliza una caché distinta; ya no hay que cambiar `CACHE_VERSION` manualmente.

La nueva caché se prepara completa antes de activarse. Después se eliminan únicamente las cachés anteriores `dash-static-*` y `dash-api-*`. Cookies, sesión, localStorage, IndexedDB y datos personales permanecen intactos.

La app comprueba nuevas versiones al abrirse o volver al primer plano y periódicamente mientras está visible. Solo recarga si cambia la versión, fuera del modo edición, de los formularios y de los guardados pendientes o fallidos. Sin un despliegue nuevo sigue usando la misma caché.

Las consultas a la API conservan su estrategia de red con respaldo de caché. Un fallo al descargar una nueva versión no elimina la app anterior.

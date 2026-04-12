# STORAGE_UPGRADE.md — Análisis: Google Apps Script vs Supabase

> Documento de arquitectura. Autor: Copilot. Fecha: 2025.
> Propósito: evaluar si migrar el backend de Google Apps Script (GAS) + Sheets a Supabase.

---

## Resumen ejecutivo

| Criterio              | Google Apps Script + Sheets | Supabase (free tier)       |
|-----------------------|-----------------------------|----------------------------|
| **Latencia media**    | 2–6 s (cold start)          | < 200 ms                   |
| **Latencia p95**      | 8–12 s                      | < 500 ms                   |
| **Quota diaria**      | 6 min ejecución / día       | 500 MB · 50 k filas · 2 GB |
| **Auth integrada**    | Manual (SHA-256 + token)    | Row-Level Security nativa  |
| **CORS**              | Requiere proxy / doGet      | Nativo con `anon` key      |
| **Coste**             | Gratis (cuenta Google)      | Gratis hasta límite free   |
| **Complejidad setup** | Alta (Apps Script editor)   | Media (UI + SQL)            |
| **Offline / cache**   | LocalStorage + SW manual    | Igual (JS es el cliente)   |
| **Backup automático** | Google Drive / Sheets       | pg_dump / Point-in-Time    |

---

## 1. Google Apps Script (estado actual)

### Ventajas
- **Coste cero** vinculado a cuenta Google existente.
- Sheets actúa como base de datos visual; edición manual de datos sin código.
- Despliegue como Web App con una URL permanente.
- Sin dependencias externas: todo en el ecosistema Google.

### Limitaciones
- **Cold start**: cada deploy sin tráfico reciente introduce 2–6 s de latencia. En móvil, puede superar 10 s.
- **Quota de ejecución**: 6 min/día para cuentas gratuitas; con múltiples operaciones simultáneas se agota rápido.
- **Sin tipado ni constraints**: Sheets no valida tipos de dato; errores silenciosos son comunes.
- **Sin Row-Level Security real**: la autenticación es gestionada manualmente con SHA-256 y tokens en sessionStorage. Cualquier leak de la URL expone el endpoint.
- **Latencia de escritura**: `ContentService.createTextOutput` bloquea hasta serializar toda la hoja.
- **Escalabilidad**: no horizontal. Una sola instancia procesa todas las peticiones.

---

## 2. Supabase

### Ventajas
- **Latencia < 200 ms** en p50; PostgreSQL con índices y conexión directa via REST/JS SDK.
- **Row-Level Security (RLS)**: políticas SQL por fila. Con una clave `anon` + política `auth.uid()` el acceso es verdaderamente seguro.
- **Auth integrada**: JWT, magic links, OAuth. Elimina la lógica manual de `checkAuth()` y `restoreSession()`.
- **Realtime**: `supabase.channel()` para sincronización en tiempo real entre pestañas/dispositivos — gratis.
- **Migraciones SQL**: historial de cambios de esquema con `supabase migrations`.
- **Edge Functions**: lógica serverless en Deno, más rápido que GAS.
- **Dashboard UI**: inspector de tablas, logs, análisis de queries.

### Limitaciones
- **Requiere cuenta Supabase** y configuración inicial (crear proyecto, tablas, políticas RLS).
- **`anon` key en el frontend**: aunque es pública por diseño (RLS la protege), se debe tratar con cuidado y documentar.
- **Free tier tiene límites de inactividad**: proyectos pausados tras 7 días sin actividad (plan gratuito antiguo) — el nuevo plan gratuito (2024) no pausa.
- **Migración de datos**: los datos actuales en Sheets/localStorage deben exportarse e importarse a PostgreSQL.

---

## 3. Análisis de impacto de migración

### Tabla de cambios necesarios

| Módulo            | Cambio requerido                                                    |
|-------------------|---------------------------------------------------------------------|
| `js/config.js`    | Añadir `SUPABASE_URL` + `SUPABASE_ANON_KEY` (sin secretos en repo) |
| `js/cloud.js`     | Reemplazar `fetch(PROXY_URL)` por `supabase.from('dashboard').upsert()` |
| `js/auth.js`      | Reemplazar SHA-256 manual por `supabase.auth.signInWithPassword()`  |
| `js/storage.js`   | Igual (localStorage sigue siendo caché offline)                     |
| `sw.js`           | Actualizar `CACHE_URLS` si cambia la URL de la API                  |
| `AGENTS.md`       | Actualizar §14 (ya no bloquea en GAS URL)                           |

### Esquema SQL sugerido

```sql
-- Una sola tabla JSONB para mantener compatibilidad con el modelo actual
CREATE TABLE dashboard (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dashboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo owner" ON dashboard
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

> El campo `payload` contiene el objeto `D` serializado (holdings, trades, etc.), igual que hoy en localStorage. Esto minimiza los cambios en `cloud.js`.

---

## 4. Recomendación

### Decisión: **Migrar a Supabase en Fase 6**

**Justificación técnica:**
1. La latencia de GAS (2–6 s cold start) ya es visible en Lighthouse como TTFB elevado.
2. La seguridad actual depende de que la URL del Web App no se filtre — Supabase con RLS elimina este punto único de fallo.
3. El Realtime de Supabase desbloquea sincronización multi-dispositivo sin código adicional.

**Precondiciones para migrar:**
- [ ] Crear proyecto Supabase y exportar `SUPABASE_URL` + `SUPABASE_ANON_KEY` como variables de entorno en GitHub Pages (no en el código).
- [ ] Ejecutar migración SQL para crear tabla `dashboard` con RLS.
- [ ] Implementar `auth.signInWithPassword()` en `auth.js` y eliminar lógica SHA-256.
- [ ] Exportar datos actuales de Sheets a JSON y hacer `upsert` inicial.

**Riesgo de migración:** Bajo. El modelo de datos no cambia (sigue siendo un blob JSONB). El localStorage sigue como caché offline. El tiempo estimado es 2–3 horas de implementación.

---

## 5. Plan de no-migración (mantener GAS)

Si se decide mantener GAS, se deben mitigar sus limitaciones:

- **Reducir cold starts**: hacer un `fetch` de "keep-alive" desde el SW al Web App cada 10 min.
- **Mejorar seguridad de URL**: rotar la URL del Web App periódicamente y almacenarla como variable de entorno o hash ofuscado.
- **Limitar escrituras**: solo llamar a `saveAndSync()` en operaciones de usuario, nunca en snapshots automáticos de precios.

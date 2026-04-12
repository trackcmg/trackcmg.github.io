# Guía: Autenticación con Token de Sesión (GAS v2)

## Estado actual (Fase 2 - frontend)

El frontend ya implementa el flujo de token (ver `js/auth.js`):

1. Al hacer login, el frontend intenta `GET GAS_URL?action=auth&pw=<hash_sha256>`
2. Si GAS devuelve `{ ok: true, token: "<uuid>" }` → el token se guarda en `sessionStorage`
3. Si GAS no tiene ese endpoint o falla → **fallback a SHA-256 local** (sin regresión)
4. En cada carga de página, `restoreSession()` comprueba si hay un token válido (< 8 h) y restaura la sesión automáticamente

El token se incluye en todas las llamadas cloud:
- GET: `?action=getData&t=...&token=<token>`
- POST: body JSON incluye `"token": "<token>"`

## Acción requerida (lado GAS)

Para activar el flujo v2, añade el siguiente código a tu Google Apps Script.

### 1. Constante de configuración (añadir al principio del script)

```javascript
// SHA-256 de tu contraseña (igual que PW_HASH en config.js del frontend)
const PW_HASH = '3b45022ab36728cdae12e709e945bba267c50ee8a91e6e4388539a8e03a3fdcd';
```

### 2. Modificar `doGet` — añadir la rama `action=auth`

Dentro de tu función `doGet(e)`, añade este bloque **antes** del bloque `action=getData`:

```javascript
// ── Autenticación con token (Fase 2) ──────────────────────────
if (e.parameter.action === 'auth') {
  const pw = e.parameter.pw || '';
  if (pw !== PW_HASH) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Invalid password' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const token = Utilities.getUuid();
  // El token caduca en 8 horas (28800 segundos)
  CacheService.getScriptCache().put('auth_' + token, '1', 28800);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, token: token }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. (Opcional) Verificar token en `doPost`

Si quieres que las escrituras también requieran token, modifica `doPost(e)` para aceptar tanto
el sistema de contraseña legacy como el nuevo token:

```javascript
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Aceptar token v2 O contraseña legacy (retrocompatibilidad)
    const token = body.token || '';
    const tokenValid = token
      ? !!CacheService.getScriptCache().get('auth_' + token)
      : false;
    const passwordValid = (body.password === PW_HASH);

    if (!tokenValid && !passwordValid) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ... tu lógica existente de guardado de datos ...

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Pasos de despliegue

1. Abre tu proyecto en [script.google.com](https://script.google.com)
2. Añade el código de la sección 2 (y opcionalmente la 3)
3. Click **Implementar → Administrar implementaciones → Editar**
4. Aumenta la versión y guarda
5. Prueba que el endpoint responde: abre en el navegador  
   `https://script.google.com/macros/s/TU_ID.../exec?action=auth&pw=contraseña_incorrecta`  
   Debe devolver `{"ok":false,"error":"Invalid password"}`

## Notas de seguridad

- El token se almacena únicamente en `sessionStorage` (se borra al cerrar el navegador/pestaña)
- El fallback SHA-256 local seguirá activo mientras no actualices GAS — no hay regresión
- `CacheService` de GAS es in-memory por instancia; el token se invalida si GAS re-instancia el script (inhabitual pero posible). En ese caso el usuario simplemente vuelve a hacer login
- El hash SHA-256 viaja por HTTPS y no es la contraseña en texto plano

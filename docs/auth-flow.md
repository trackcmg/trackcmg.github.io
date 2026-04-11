# Flujo de Autenticación

## Estado Actual (Fase 1) — SHA-256 Client-Side

La contraseña se valida en el frontend comparando el hash SHA-256 del input contra una constante `PW_HASH` en `config.js`. No hay token de sesión; el estado `_authed` vive en memoria de la pestaña.

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Browser (auth.js)
  participant S as state.js (_authed)

  U->>B: Click "Login", introduce contraseña
  B->>B: sha256(password) → inputHash
  B->>B: inputHash === PW_HASH?

  alt Contraseña correcta
    B->>S: setAuthed(true)
    B->>B: dispatchEvent('dashboard:auth-success')
    B->>U: Botón → "🔓 Unlocked", muestra controles edición
    B->>B: fetchDataFromCloud() + renderAll()
  else Contraseña incorrecta
    B->>U: Muestra "Wrong password" en modal
  end
```

**Limitaciones de seguridad actuales:**
- `PW_HASH` es públicamente visible en el source del repositorio (aunque no es la contraseña en texto plano)
- Sin token de sesión: cerrar y reabrir la pestaña requiere re-autenticación (✓ buena práctica)
- Sin protección contra fuerza bruta en frontend (no relevante para uso personal)
- GAS acepta peticiones con el hash como "password", pero cualquiera que vea el source puede enviar el hash

---

## Estado Objetivo (Fase 2) — Token server-side via GAS

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Browser (auth.js)
  participant G as Google Apps Script
  participant T as sessionStorage / localStorage

  U->>B: Click "Login", introduce contraseña

  B->>B: sha256(password) → hash
  B->>G: POST {action: "auth", hash}
  G->>G: Compara hash contra PropertiesService (server-side)

  alt Hash correcto
    G->>G: Genera token UUID aleatorio con TTL 24h
    G-->>B: {token, expiresAt}
    B->>T: Guarda token (sessionStorage por defecto, localStorage si "Recordarme")
    B->>U: "🔓 Unlocked"
    B->>G: GET {action: "getData", token} — token en header/body
    G->>G: Valida token y TTL
    G-->>B: {holdings, trades, gym, books, movies, series}
  else Hash incorrecto
    G-->>B: {error: "Unauthorized"}
    B->>U: "Wrong password"
  end

  Note over B,G: Todas las peticiones POST (sync) incluyen el token.<br/>GAS invalida el token si detecta manipulación.

  U->>B: Recarga la página / abre nueva pestaña
  B->>T: Lee token guardado
  B->>G: GET {action: "validateToken", token}
  alt Token válido
    G-->>B: {valid: true}
    B->>U: Auto-login silencioso
  else Token expirado
    G-->>B: {valid: false}
    B->>T: Elimina token
    B->>U: Muestra botón Login
  end
```

**Mejoras de seguridad en Fase 2:**
- `PW_HASH` desaparece del frontend
- Validación siempre server-side (GAS `PropertiesService`)
- Token con TTL: exposición limitada en el tiempo
- Cada sync verifica token: no es posible hacer escrituras sin autenticación válida

---

## Comparativa de Seguridad

| Aspecto | Fase 1 (actual) | Fase 2 (objetivo) |
|---|---|---|
| Validación de contraseña | Client-side (SHA-256) | Server-side (GAS) |
| Estado de sesión | `_authed` en memoria | Token en sessionStorage/localStorage |
| Persistencia de sesión | No (se pierde al recargar) | Sí, con TTL configurable |
| Secrets en frontend | `PW_HASH` visible | Sin secrets en frontend |
| Protección de escrituras | Condicional en JS | Token requerido en GAS |

---

## Intervención Humana Requerida para Fase 2

Para implementar el flujo objetivo, se debe modificar el código de Google Apps Script con:

1. **Endpoint `auth`**: recibe hash, compara contra `PropertiesService.getScriptProperties().getProperty('PW_HASH')`, genera y almacena token UUID con TTL
2. **Middleware de token**: cada endpoint `getData`, `setData`, etc. verifica el token antes de operar
3. **Endpoint `validateToken`**: comprueba si un token sigue siendo válido

El código GAS de referencia se proporcionará al inicio de la Fase 2.

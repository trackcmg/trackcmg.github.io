// ============================================================
//  secrets.js — Inicialización de APP_SECRETS en localStorage
//
//  POLÍTICA ZERO SECRETS: Ninguna URL, hash ni clave vive en
//  el código fuente. La primera vez que se carga la app sin
//  APP_SECRETS en localStorage, se muestra un modal de setup.
//  El usuario introduce sus credenciales; se guardan cifradas
//  en localStorage y nunca salen al repositorio.
//
//  Para resetear los secretos desde consola:
//    localStorage.removeItem('APP_SECRETS'); location.reload();
// ============================================================

const SECRETS_KEY = 'APP_SECRETS';

// Campos requeridos y sus metadatos para el modal
const FIELDS = [
  { key: 'STORAGE_MODE',  label: 'Storage Mode', placeholder: 'gas  (or: supabase)', type: 'text',     required: true  },
  { key: 'GAS_URL',       label: 'GAS Web App URL',  placeholder: 'https://script.google.com/...', type: 'url', required: true  },
  { key: 'PROXY_URL',     label: 'Proxy URL (dejar vacío = igual que GAS URL)', placeholder: '(optional)', type: 'url', required: false },
  { key: 'PW_HASH',       label: 'Password SHA-256 hash', placeholder: '64 hex chars', type: 'text',   required: true  },
  { key: 'SUPABASE_URL',  label: 'Supabase URL',     placeholder: 'https://xxx.supabase.co', type: 'url',  required: false },
  { key: 'SUPABASE_KEY',  label: 'Supabase Anon Key', placeholder: 'eyJ...', type: 'text',             required: false },
];

// Devuelve el objeto de secretos guardado, o null si no existe / está corrupto
export function loadSecrets() {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj.GAS_URL || !obj.PW_HASH) return null;
    return obj;
  } catch {
    return null;
  }
}

// Guarda el objeto de secretos en localStorage
export function saveSecrets(obj) {
  if (!obj.PROXY_URL) obj.PROXY_URL = obj.GAS_URL;
  if (!obj.STORAGE_MODE) obj.STORAGE_MODE = 'gas';
  localStorage.setItem(SECRETS_KEY, JSON.stringify(obj));
}

// Inyecta el CSS del modal de setup (solo una vez)
function _injectStyle() {
  if (document.getElementById('__secrets-style')) return;
  const s = document.createElement('style');
  s.id = '__secrets-style';
  s.textContent = `
    #__secrets-overlay {
      position:fixed; inset:0; z-index:99999;
      background:rgba(6,6,17,.97); display:flex;
      align-items:center; justify-content:center;
      font-family:'IBM Plex Mono',monospace;
    }
    #__secrets-box {
      background:#0d0d1a; border:1px solid #2a2a4a;
      border-radius:16px; padding:32px 28px; width:min(480px,94vw);
      box-shadow:0 8px 40px rgba(0,0,0,.6);
    }
    #__secrets-box h2 {
      color:#e2e2f0; font-size:15px; font-weight:700;
      margin:0 0 6px; letter-spacing:.5px;
    }
    #__secrets-box p {
      color:#6060a0; font-size:11px; margin:0 0 20px; line-height:1.6;
    }
    #__secrets-box label {
      display:block; color:#7070a0; font-size:10px; text-transform:uppercase;
      letter-spacing:.8px; margin-bottom:4px; margin-top:12px;
    }
    #__secrets-box input {
      width:100%; box-sizing:border-box;
      background:#111126; border:1px solid #2a2a4a; border-radius:8px;
      color:#e2e2f0; font-family:'IBM Plex Mono',monospace; font-size:12px;
      padding:8px 12px; outline:none; transition:.2s;
    }
    #__secrets-box input:focus { border-color:#22df8a; }
    #__secrets-err {
      color:#ff4466; font-size:11px; margin-top:10px; display:none;
    }
    #__secrets-submit {
      margin-top:20px; width:100%; padding:10px;
      background:rgba(34,223,138,.12); border:1px solid #22df8a;
      border-radius:8px; color:#22df8a; font-family:'IBM Plex Mono',monospace;
      font-size:12px; font-weight:700; cursor:pointer; transition:.15s;
    }
    #__secrets-submit:hover { background:rgba(34,223,138,.22); }
    #__secrets-hint {
      color:#3a3a6a; font-size:10px; margin-top:16px; line-height:1.7;
    }
  `;
  document.head.appendChild(s);
}

// Construye y muestra el modal; devuelve una Promise que resuelve
// cuando el usuario guarda correctamente los secretos.
export function showSecretsModal() {
  return new Promise(resolve => {
    _injectStyle();

    const overlay = document.createElement('div');
    overlay.id = '__secrets-overlay';

    const box = document.createElement('div');
    box.id = '__secrets-box';

    box.innerHTML = `
      <h2>⚙️ First-time Setup — App Credentials</h2>
      <p>These credentials are stored only in your browser (localStorage).<br>
         They are never sent to GitHub or any third party.</p>
      ${FIELDS.map(f => `
        <label for="__s_${f.key}">${f.label}${f.required ? ' <span style="color:#ff4466">*</span>' : ''}</label>
        <input id="__s_${f.key}" type="${f.type}" placeholder="${f.placeholder}" autocomplete="off" spellcheck="false">
      `).join('')}
      <div id="__secrets-err">Please fill all required fields (marked *).</div>
      <button id="__secrets-submit">Save &amp; Continue →</button>
      <div id="__secrets-hint">
        To reset credentials: <code>localStorage.removeItem('APP_SECRETS')</code> + reload.<br>
        STORAGE_MODE: use <strong>gas</strong> (default) or <strong>supabase</strong>.
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('__secrets-submit').addEventListener('click', () => {
      const obj = {};
      let valid = true;

      for (const f of FIELDS) {
        const val = document.getElementById('__s_' + f.key)?.value.trim() || '';
        if (f.required && !val) { valid = false; break; }
        if (val) obj[f.key] = val;
      }

      if (!valid) {
        document.getElementById('__secrets-err').style.display = 'block';
        return;
      }

      saveSecrets(obj);
      overlay.remove();
      resolve(obj);
    });
  });
}

// Punto de entrada principal: asegura que APP_SECRETS existe antes de continuar.
// Devuelve una Promise que resuelve con el objeto de secretos.
export async function initSecrets() {
  const existing = loadSecrets();
  if (existing) return existing;
  return await showSecretsModal();
}

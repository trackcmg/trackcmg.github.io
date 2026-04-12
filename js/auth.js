// ============================================================
//  auth.js — Supabase Auth (Phase 7.3)
//
//  Flujo:  onAuthStateChange  →  handleLogin / handleLogout (app.js)
//  signIn()  →  supabase.auth.signInWithPassword()
//  signOut() →  supabase.auth.signOut()
//
//  sha256() kept as utility for the Migration Bridge easter egg.
// ============================================================
import { setAuthed, setCurrentUser } from './state.js';
import { getSupabaseClient } from './cloud.js';

// ── SHA-256 helper (Web Crypto API) — used by Migration Bridge ────────────
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Set up Supabase auth state listener ───────────────────────────────────
// onLogin(user, isNewLogin) is called when a session is found or created.
// onLogout() is called when the session ends.
export function initAuth(onLogin, onLogout) {
  const sb = getSupabaseClient();
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      setCurrentUser(session.user);
      setAuthed(true);
      onLogin(session.user, event === 'SIGNED_IN');
    } else {
      setCurrentUser(null);
      setAuthed(false);
      onLogout();
    }
  });
}

// ── Sign in via email + password ──────────────────────────────────────────
// Returns { user, error }. Never throws.
export async function signIn(email, password) {
  try {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    return { user: data?.user || null, error };
  } catch (e) {
    return { user: null, error: e };
  }
}

// ── Sign out the current user ─────────────────────────────────────────────
export async function signOut() {
  await getSupabaseClient().auth.signOut();
}


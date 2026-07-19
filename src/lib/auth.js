/* auth.js — client-side session + authenticated fetch.
   Token and user persist in localStorage ("eq_token" / "eq_user").
   authFetch injects the Bearer header on every call and, on a 401,
   clears the session and broadcasts a window "auth:required" event so
   App can open the sign-in modal from anywhere. */

const TOKEN_KEY = "eq_token";
const USER_KEY  = "eq_user";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable — session lives for this page only */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* noop */ }
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* fetch wrapper: injects the Bearer header; on 401 clears the session and
   dispatches "auth:required" so the app can prompt for sign-in. The 401
   response is still returned/thrown to the caller — no silent retries. */
export async function authFetch(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...authHeaders() },
  });
  if (r.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent("auth:required"));
  }
  return r;
}

/* ── API helpers ─────────────────────────────────────────────────────── */

async function authPost(API, path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Request failed (${r.status})`);
  return data; // { token, user }
}

export async function signup(API, email, password, name, consent = false) {
  const data = await authPost(API, "/api/auth/signup",
                              { email, password, name, consent });
  // With SMTP configured server-side, the account doesn't exist yet — the
  // caller must collect the emailed 6-digit code and call verifySignup.
  if (data.pending_verification) return data;
  setSession(data.token, data.user);
  return data.user;
}

export async function verifySignup(API, email, code) {
  const data = await authPost(API, "/api/auth/verify", { email, code });
  setSession(data.token, data.user);
  return data.user;
}

export async function resendCode(API, email) {
  return authPost(API, "/api/auth/resend-code", { email });
}

export async function login(API, email, password) {
  const data = await authPost(API, "/api/auth/login", { email, password });
  setSession(data.token, data.user);
  return data.user;
}

/* SEC-01: "sign out everywhere" — the backend bumps this account's token
   version (killing every other device's token) and returns a fresh token for
   THIS session, which we persist so the current tab stays signed in. */
export async function logoutAll(API) {
  const r = await fetch(`${API}/api/auth/logout-all`, {
    method: "POST", headers: authHeaders(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `Request failed (${r.status})`);
  if (data.token) setSession(data.token, data.user);
  return data.user;
}

/* Validate the stored token against the backend. Returns the fresh user,
   or null (and clears the session) when the token is missing/invalid. */
export async function me(API) {
  if (!getToken()) return null;
  try {
    const r = await fetch(`${API}/api/auth/me`, { headers: authHeaders() });
    if (!r.ok) { if (r.status === 401) clearSession(); return null; }
    const data = await r.json();
    if (data?.user) setSession(getToken(), data.user);
    return data?.user || null;
  } catch { return getUser(); /* network blip — keep the cached session */ }
}

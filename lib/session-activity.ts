export const SESSION_ACTIVITY_KEY = 'psycore:last-activity';
export const SESSION_TIMEOUT_MS = 5 * 60 * 60 * 1000;

export function markSessionActivity(now = Date.now()) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
}

export function getLastSessionActivity() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_ACTIVITY_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function clearSessionActivity() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_ACTIVITY_KEY);
}

export function sessionIsExpired(now = Date.now()) {
  const lastActivity = getLastSessionActivity();
  return lastActivity !== null && now - lastActivity >= SESSION_TIMEOUT_MS;
}

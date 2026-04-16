import type { SessionInfo } from '../types';

const STORAGE_KEY = 'liveclass-lite-session';

export function saveSession(session: SessionInfo) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): SessionInfo | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionInfo;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSession() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}


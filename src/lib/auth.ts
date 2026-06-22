import { STORAGE_KEYS } from "./constants";

export const ADMIN_AUTH_KEY = STORAGE_KEYS.ADMIN_AUTH;

export function getSessionToken(): string | null {
  return sessionStorage.getItem(ADMIN_AUTH_KEY);
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(ADMIN_AUTH_KEY, token);
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return getSessionToken() !== null;
}

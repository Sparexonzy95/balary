import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "./env";
import { routes } from "./routes";
import type { AuthSession } from "./types";

const SESSION_KEY = "zalary_session";
export const SESSION_CHANGED_EVENT = "zalary_session_changed";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retryAfterRefresh?: boolean;
};

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

const bareApi = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

let refreshPromise: Promise<AuthSession> | null = null;

function notifySessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    notifySessionChanged();
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifySessionChanged();
}

export function getAccessToken() {
  return getStoredSession()?.access || "";
}

async function refreshStoredSession() {
  const session = getStoredSession();
  if (!session?.refresh) {
    throw new Error("Missing refresh token");
  }
  if (!refreshPromise) {
    refreshPromise = bareApi
      .post<{ access: string; refresh?: string }>(routes.auth.refresh, { refresh: session.refresh })
      .then((response) => {
        const nextSession = {
          ...session,
          access: response.data.access,
          refresh: response.data.refresh || session.refresh,
        };
        storeSession(nextSession);
        return nextSession;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw error;
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isAuthRequest =
      originalRequest?.url === routes.auth.nonce ||
      originalRequest?.url === routes.auth.verify ||
      originalRequest?.url === routes.auth.refresh;

    if (isAuthRequest || !originalRequest || originalRequest._retryAfterRefresh) {
      if (!isAuthRequest) storeSession(null);
      throw error;
    }

    originalRequest._retryAfterRefresh = true;
    try {
      const refreshedSession = await refreshStoredSession();
      originalRequest.headers.Authorization = `Bearer ${refreshedSession.access}`;
      return api(originalRequest);
    } catch {
      storeSession(null);
      throw error;
    }
  },
);

function objectMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const candidate = value as Record<string, unknown>;

  for (const key of ["shortMessage", "reason", "message", "details", "detail", "error"]) {
    const next = candidate[key];
    if (typeof next === "string" && next.trim()) return next.trim();
    const nested = objectMessage(next);
    if (nested) return nested;
  }

  const dataMessage = objectMessage(candidate.data);
  if (dataMessage) return dataMessage;

  return "";
}

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const responseMessage = objectMessage(axiosError.response?.data);
    return responseMessage || axiosError.message;
  }
  if (error instanceof Error && error.message) return error.message;
  const providerMessage = objectMessage(error);
  if (providerMessage) return providerMessage;
  if (typeof error === "string" && error.trim()) return error.trim();
  return "An unknown wallet or network error occurred";
}

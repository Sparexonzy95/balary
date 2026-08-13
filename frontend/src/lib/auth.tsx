import React from "react";
import { api, errorMessage, getStoredSession, SESSION_CHANGED_EVENT, storeSession } from "./api";
import { routes } from "./routes";
import type { Account, AuthSession } from "./types";

type AuthContextValue = {
  account: Account | null;
  accessToken: string;
  isAuthenticated: boolean;
  loginWithWallet: (walletAddress: string, signMessage: (message: string) => Promise<string>) => Promise<AuthSession>;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(() => getStoredSession());

  React.useEffect(() => {
    function syncStoredSession() {
      setSession(getStoredSession());
    }
    window.addEventListener(SESSION_CHANGED_EVENT, syncStoredSession);
    window.addEventListener("storage", syncStoredSession);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, syncStoredSession);
      window.removeEventListener("storage", syncStoredSession);
    };
  }, []);

  const loginWithWallet = React.useCallback(
    async (walletAddress: string, signMessage: (message: string) => Promise<string>) => {
      let nonce: { data: { message: string; nonce: string } };
      try {
        nonce = await api.post<{ message: string; nonce: string }>(routes.auth.nonce, {
          wallet_address: walletAddress,
        });
      } catch (error) {
        throw new Error(`Nonce request failed: ${errorMessage(error)}`);
      }

      let signature: string;
      try {
        signature = await signMessage(nonce.data.message);
      } catch (error) {
        throw new Error(`Wallet signature failed: ${errorMessage(error)}`);
      }

      let verified: { data: AuthSession };
      try {
        verified = await api.post<AuthSession>(routes.auth.verify, {
          wallet_address: walletAddress,
          nonce: nonce.data.nonce,
          signature,
        });
      } catch (error) {
        throw new Error(`Signature verification failed: ${errorMessage(error)}`);
      }

      setSession(verified.data);
      storeSession(verified.data);
      return verified.data;
    },
    [],
  );

  const logout = React.useCallback(() => {
    setSession(null);
    storeSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        account: session?.account || null,
        accessToken: session?.access || "",
        isAuthenticated: Boolean(session?.access),
        loginWithWallet,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

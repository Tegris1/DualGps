import { createContext, type ReactNode, useContext, useState } from "react";

export const OFFLINE_ACCOUNT = { email: "offline@dualgps.local", password: "Offline123!" };
type OfflineSession = {
  isSignedIn: boolean;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
};
const OfflineSessionContext = createContext<OfflineSession | undefined>(undefined);

export function OfflineSessionProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setSignedIn] = useState(false);
  function signIn(email: string, password: string) {
    const valid = email.trim().toLowerCase() === OFFLINE_ACCOUNT.email
      && password === OFFLINE_ACCOUNT.password;
    if (valid) setSignedIn(true);
    return valid;
  }
  return (
    <OfflineSessionContext.Provider value={{ isSignedIn, signIn, signOut: () => setSignedIn(false) }}>
      {children}
    </OfflineSessionContext.Provider>
  );
}

export function useOfflineSession() {
  const session = useContext(OfflineSessionContext);
  if (!session) throw new Error("useOfflineSession requires OfflineSessionProvider");
  return session;
}

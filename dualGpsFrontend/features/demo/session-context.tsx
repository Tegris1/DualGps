import { createContext, type ReactNode, useContext, useState } from "react";

export const DEMO_ACCOUNT = { email: "demo@dualgps.local", password: "Demo123!" };
type DemoSession = {
  isSignedIn: boolean;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
};
const DemoSessionContext = createContext<DemoSession | undefined>(undefined);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setSignedIn] = useState(false);
  function signIn(email: string, password: string) {
    const valid = email.trim().toLowerCase() === DEMO_ACCOUNT.email
      && password === DEMO_ACCOUNT.password;
    if (valid) setSignedIn(true);
    return valid;
  }
  return (
    <DemoSessionContext.Provider value={{ isSignedIn, signIn, signOut: () => setSignedIn(false) }}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const session = useContext(DemoSessionContext);
  if (!session) throw new Error("useDemoSession requires DemoSessionProvider");
  return session;
}

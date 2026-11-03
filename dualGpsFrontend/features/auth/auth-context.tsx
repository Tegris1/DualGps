import { authApi } from "@/features/auth/api/auth-api";
import { toAuthFailure, type AuthFailure } from "@/features/auth/errors";
import { createSecureStorage } from "@/lib/secure-storage";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const AUTH_SESSION_KEY = "dualgps.auth-session";
const authSessionStorage = createSecureStorage("session");

type AuthUser = {
  email: string;
};

type StoredSession = {
  token: string;
  email: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoadingUser: boolean;
  signUp: (
    username: string,
    email: string,
    password: string,
  ) => Promise<AuthFailure | null>;
  signIn: (email: string, password: string) => Promise<AuthFailure | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseStoredSession(value: string | null): StoredSession | null {
  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as Partial<StoredSession>;

    if (typeof session.token === "string" && typeof session.email === "string") {
      return { token: session.token, email: session.email };
    }
  } catch {
    // Invalid stored data is treated as a signed-out session.
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedValue = await authSessionStorage.getItem(AUTH_SESSION_KEY);
        const session = parseStoredSession(storedValue);

        if (session) {
          setToken(session.token);
          setUser({ email: session.email });
        } else if (storedValue) {
          await authSessionStorage.removeItem(AUTH_SESSION_KEY);
        }
      } catch (error) {
        console.error("Could not restore the authentication session:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    void restoreSession();
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthFailure | null> => {
    const normalizedEmail = email.trim().toLowerCase();
    let session: StoredSession;

    try {
      const response = await authApi.login({
        email: normalizedEmail,
        password,
      });
      session = {
        token: response.token,
        email: normalizedEmail,
      };
    } catch (error) {
      return toAuthFailure(error);
    }

    try {
      await authSessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } catch (cause) {
      return { kind: "persistence", cause };
    }

    setToken(session.token);
    setUser({ email: session.email });
    return null;
  };

  const signUp = async (
    username: string,
    email: string,
    password: string,
  ): Promise<AuthFailure | null> => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await authApi.register({
        username: username.trim(),
        email: normalizedEmail,
        password,
      });
    } catch (error) {
      return toAuthFailure(error);
    }

    return signIn(normalizedEmail, password);
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);

    try {
      await authSessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (error) {
      console.error("Could not remove the authentication session:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoadingUser, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

import { authApi } from "@/features/auth/api/auth-api";
import { AuthApiError } from "@/features/auth/api/auth-errors";
import { toAuthFailure, type AuthFailure } from "@/features/auth/errors";
import { getSessionRole, type UserRole } from "@/features/auth/session-role";
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
  role: UserRole;
};

type StoredSession = {
  token: string;
  email: string;
};

type AuthSession = StoredSession & { role: UserRole };

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

function parseStoredSession(value: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as Partial<StoredSession>;

    if (typeof session.token === "string" && typeof session.email === "string") {
      const role = getSessionRole(session.token);
      if (role) return { token: session.token, email: session.email, role };
    }
  } catch {
    // Invalid stored data is treated as a signed-out session.
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedValue = await authSessionStorage.getItem(AUTH_SESSION_KEY);
        const session = parseStoredSession(storedValue);

        if (session) {
          setSession(session);
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
    let session: AuthSession;

    try {
      const response = await authApi.login({
        email: normalizedEmail,
        password,
      });
      const role = getSessionRole(response.token);
      if (!role) throw new AuthApiError("invalid-response");
      session = {
        token: response.token,
        email: normalizedEmail,
        role,
      };
    } catch (error) {
      return toAuthFailure(error);
    }

    try {
      const storedSession: StoredSession = { token: session.token, email: session.email };
      await authSessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(storedSession));
    } catch (cause) {
      return { kind: "persistence", cause };
    }

    setSession(session);
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
    setSession(null);

    try {
      await authSessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (error) {
      console.error("Could not remove the authentication session:", error);
    }
  };

  const user = session ? { email: session.email, role: session.role } : null;

  return (
    <AuthContext.Provider
      value={{ user, token: session?.token ?? null, isLoadingUser, signUp, signIn, signOut }}
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

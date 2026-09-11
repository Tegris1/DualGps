import { authApi, AuthApiError } from "@/api/authApi";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

const AUTH_SESSION_KEY = "dualgps.auth-session";

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
  ) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readStoredSession(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(AUTH_SESSION_KEY);
  }

  return SecureStore.getItemAsync(AUTH_SESSION_KEY);
}

async function storeSession(value: string): Promise<void> {
  if (Platform.OS === "web") {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(AUTH_SESSION_KEY, value);
}

async function removeStoredSession(): Promise<void> {
  if (Platform.OS === "web") {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

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

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  return "An unexpected authentication error occurred.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedValue = await readStoredSession();
        const session = parseStoredSession(storedValue);

        if (session) {
          setToken(session.token);
          setUser({ email: session.email });
        } else if (storedValue) {
          await removeStoredSession();
        }
      } catch (error) {
        console.error("Could not restore the authentication session:", error);
      } finally {
        setIsLoadingUser(false);
      }
    }

    void restoreSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await authApi.login({
        email: normalizedEmail,
        password,
      });
      const session: StoredSession = {
        token: response.token,
        email: normalizedEmail,
      };

      await storeSession(JSON.stringify(session));
      setToken(session.token);
      setUser({ email: session.email });
      return null;
    } catch (error) {
      return getAuthErrorMessage(error);
    }
  };

  const signUp = async (
    username: string,
    email: string,
    password: string,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await authApi.register({
        username: username.trim(),
        email: normalizedEmail,
        password,
      });
    } catch (error) {
      return getAuthErrorMessage(error);
    }

    return signIn(normalizedEmail, password);
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);

    try {
      await removeStoredSession();
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

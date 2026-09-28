import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as authApi from "../api/auth";
import { setAccessTokenRef, setOnAuthFailure } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const accessTokenRef = useRef(null);

  const setAccessToken = useCallback((token) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("refresh_token");
  }, [setAccessToken]);

  useEffect(() => {
    setAccessTokenRef(accessTokenRef);
    setOnAuthFailure(clearAuth);
  }, [clearAuth]);

  const applyAuthResponse = useCallback(
    (data) => {
      setAccessToken(data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      setUser(data.user);
    },
    [setAccessToken]
  );

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials);
      applyAuthResponse(data);
      return data.user;
    },
    [applyAuthResponse]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authApi.register(payload);
      applyAuthResponse(data);
      return data.user;
    },
    [applyAuthResponse]
  );

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort: proceed to clear local state regardless
    }
    clearAuth();
  }, [clearAuth]);

  useEffect(() => {
    const storedRefresh = localStorage.getItem("refresh_token");
    if (!storedRefresh) {
      setInitializing(false);
      return;
    }
    (async () => {
      try {
        const data = await authApi.refresh(storedRefresh);
        setAccessToken(data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        const me = await authApi.getMe();
        setUser(me);
      } catch {
        clearAuth();
      } finally {
        setInitializing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, initializing, login, register, logout, updateUser }),
    [user, accessToken, initializing, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}

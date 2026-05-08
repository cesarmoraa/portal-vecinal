import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshSession() {
    setLoading(true);

    try {
      const response = await apiRequest("/auth/me");
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function login(payload) {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: payload,
    });
    setUser(response.user);
    return response.user;
  }

  async function logout() {
    await apiRequest("/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function changePin(payload) {
    await apiRequest("/auth/change-pin", {
      method: "POST",
      body: payload,
    });
    await refreshSession();
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      changePin,
      refreshSession,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}


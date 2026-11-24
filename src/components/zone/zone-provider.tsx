"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, User } from "@/lib/zone";

const ZoneContext = createContext<{
  user: User | null; loading: boolean; setUser: (user: User | null) => void;
  refresh: () => Promise<void>; logout: () => Promise<void>;
} | null>(null);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const data = await api<{ user: User | null }>("/api/auth/me"); setUser(data.user); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);
  // Session state is synchronized from the asynchronous API response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  const logout = useCallback(async () => { await api("/api/auth/logout", { method: "POST", body: "{}" }); setUser(null); }, []);
  const value = useMemo(() => ({ user, loading, setUser, refresh, logout }), [user, loading, refresh, logout]);
  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const context = useContext(ZoneContext);
  if (!context) throw new Error("useZone must be used inside ZoneProvider");
  return context;
}

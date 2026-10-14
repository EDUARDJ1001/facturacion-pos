import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, configureApi } from '@/lib/api';
import { loadConfig, loadTokens, saveConfig, saveTokens, type PosConfig } from '@/lib/storage';
import type { AuthUser, Company, LoginResponse, MeResponse } from '@/lib/types';

interface SessionValue {
  ready: boolean;
  config: PosConfig;
  user: AuthUser | null;
  companies: Company[];
  company: Company | null;
  permissions: Set<string>;
  setServerUrl: (url: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  selectCompany: (company: Company) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<PosConfig>({ serverUrl: null, companyId: null });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const updateConfig = useCallback(async (next: PosConfig) => {
    configureApi({ serverUrl: next.serverUrl, companyId: next.companyId });
    setConfig(next);
    await saveConfig(next);
  }, []);

  const clearSession = useCallback(async () => {
    await saveTokens(null);
    setUser(null);
    setCompanies([]);
    setPermissions(new Set());
  }, []);

  useEffect(() => {
    configureApi({ onSessionExpired: () => void clearSession() });
    (async () => {
      const stored = await loadConfig();
      configureApi({ serverUrl: stored.serverUrl, companyId: stored.companyId });
      setConfig(stored);
      if (stored.serverUrl && (await loadTokens())) {
        try {
          const me = await api<MeResponse>('/api/auth/me');
          setUser(me.user);
          setCompanies(me.companies);
          setPermissions(new Set(me.permissions));
        } catch (error) {
          // Sin red se queda la sesión guardada y la pantalla de venta mostrará el error;
          // solo una sesión rechazada (401) obliga a entrar de nuevo.
          if (error instanceof ApiError && error.status === 401) {
            await clearSession();
          }
        }
      }
      setReady(true);
    })();
  }, [clearSession]);

  const value = useMemo<SessionValue>(() => {
    const company =
      companies.find((item) => item.id === config.companyId) ?? (companies.length === 1 ? companies[0] : null);
    return {
      ready,
      config,
      user,
      companies,
      company,
      permissions,
      can: (permission) => permissions.has(permission),
      setServerUrl: async (url) => {
        await clearSession();
        await updateConfig({ serverUrl: url, companyId: null });
      },
      login: async (username, password) => {
        const result = await api<LoginResponse>('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { username, password },
        });
        await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setUser(result.user);
        setCompanies(result.companies);
        setPermissions(new Set(result.permissions));
        // Con una sola empresa se selecciona sola; si la guardada ya no está, se pide de nuevo.
        const keep = result.companies.find((item) => item.id === config.companyId);
        const only = result.companies.length === 1 ? result.companies[0] : null;
        await updateConfig({ ...config, companyId: keep?.id ?? only?.id ?? null });
      },
      selectCompany: async (selected) => {
        await updateConfig({ ...config, companyId: selected.id });
        await api('/api/companies/select', { method: 'POST', body: { companyId: selected.id } });
      },
      logout: clearSession,
    };
  }, [ready, config, user, companies, permissions, clearSession, updateConfig]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession fuera de SessionProvider');
  }
  return value;
}

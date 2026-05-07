import { createContext, useContext, useMemo, useState } from 'react';

type AuthContextValue = {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('mapleboard.token'));

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      setToken: (nextToken) => {
        localStorage.setItem('mapleboard.token', nextToken);
        setTokenState(nextToken);
      },
      logout: () => {
        localStorage.removeItem('mapleboard.token');
        setTokenState(null);
      }
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

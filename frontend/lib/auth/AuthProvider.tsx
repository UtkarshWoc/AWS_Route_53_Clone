import { createContext, useContext } from 'react';

const AuthContext = createContext<any>(null);

export function useAuth() {
  return { session: { displayName: "Demo User", accountId: "123456789012" } };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserStaff } from '../types';
import { apiRequest, getAuthToken, setAuthToken } from '../api';

interface AuthContextType {
  currentUser: UserStaff | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserStaff) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserStaff | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const savedToken = getAuthToken();
      if (!savedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const user = await apiRequest<UserStaff>('/api/auth/me');
        setCurrentUser(user);
        setToken(savedToken);
      } catch (err) {
        console.warn('Session expired or invalid, logging out.');
        setAuthToken(null);
        setCurrentUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = (newToken: string, user: UserStaff) => {
    setAuthToken(newToken);
    setToken(newToken);
    setCurrentUser(user);
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

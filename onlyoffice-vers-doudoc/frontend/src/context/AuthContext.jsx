import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as apiLogin, register as apiRegister, switchRole as apiSwitchRole } from '../api/libraryApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState({
    username: 'saravana',
    name: 'Saravana Priyan S T',
    role: 'user',
    email: 'saravana@mkce.ac.in'
  });
  const [token, setToken] = useState(localStorage.getItem('documind_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await getMe();
        if (res.user) {
          setUser(res.user);
        }
      } catch (err) {
        console.warn('Using local demo credentials:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const res = await apiLogin(username, password);
    if (res.access_token) {
      localStorage.setItem('documind_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    }
    return res;
  };

  const register = async (data) => {
    const res = await apiRegister(data);
    if (res.access_token) {
      localStorage.setItem('documind_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('documind_token');
    setToken(null);
    setUser({
      username: 'guest',
      name: 'Guest User',
      role: 'user',
      email: 'guest@documind.local'
    });
  };

  const switchRole = async (newRole) => {
    try {
      const res = await apiSwitchRole(newRole);
      if (res.access_token) {
        localStorage.setItem('documind_token', res.access_token);
        setToken(res.access_token);
      }
      setUser(res.user);
    } catch (err) {
      setUser((prev) => ({ ...prev, role: newRole }));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

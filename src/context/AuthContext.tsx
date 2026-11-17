import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider, syncFirebaseUserProfile } from '../lib/firebase';
import { api } from '../services/api';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'STAFF';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  customerId?: number;
  staffId?: number;
  adminId?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  customerProfile: any;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<AuthUser>;
  registerCustomer: (payload: { name: string; email: string; phone?: string; password: string; city?: string }) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('caterease_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(localStorage.getItem('caterease_token')));

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('caterease_token');
    if (!token) {
      setUser(null);
      setCustomerProfile(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      const loadedUser = res.data.data.user;
      setUser(loadedUser);
      setCustomerProfile(res.data.data.customerProfile || null);
      localStorage.setItem('caterease_user', JSON.stringify(loadedUser));
    } catch {
      localStorage.removeItem('caterease_token');
      localStorage.removeItem('caterease_user');
      setUser(null);
      setCustomerProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: loggedUser } = res.data.data;
    localStorage.setItem('caterease_token', token);
    localStorage.setItem('caterease_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    await refreshProfile();
    return loggedUser;
  };

  const registerCustomer = async (payload: { name: string; email: string; phone?: string; password: string; city?: string }) => {
    const res = await api.post('/auth/register', payload);
    const { token, user: regUser } = res.data.data;
    localStorage.setItem('caterease_token', token);
    localStorage.setItem('caterease_user', JSON.stringify(regUser));
    setUser(regUser);
    await refreshProfile();
    return regUser;
  };

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    localStorage.setItem('caterease_token', idToken);
    const res = await api.post('/auth/google-sync', {}, { headers: { Authorization: `Bearer ${idToken}` } });
    const syncedUser = res.data.data.user;
    localStorage.setItem('caterease_user', JSON.stringify(syncedUser));
    setUser(syncedUser);
    await syncFirebaseUserProfile({
      uid: cred.user.uid,
      displayName: cred.user.displayName || syncedUser.name || 'CaterEase User',
      email: cred.user.email || syncedUser.email,
      photoURL: cred.user.photoURL,
    }).catch((err) => {
      console.warn('Firestore profile sync skipped:', err);
    });
    await refreshProfile();
    return syncedUser;
  };

  const logout = async () => {
    localStorage.removeItem('caterease_token');
    localStorage.removeItem('caterease_user');
    setUser(null);
    setCustomerProfile(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase sign-out error if signed in via local JWT
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customerProfile,
        loading,
        loginWithEmail,
        registerCustomer,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useUser,
} from '@clerk/react';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import type { User } from '@workspace/api-client-react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  adminLogin: (token: string) => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_USER: User = {
  id: 0,
  firstName: 'Admin',
  lastName: '',
  username: 'admin',
  email: '',
  bio: '',
  createdAt: '',
};

export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
export const isClerkEnabled = Boolean(clerkPublishableKey);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkAuthProvider>{children}</ClerkAuthProvider>
      </ClerkProvider>
    );
  }
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}

function LegacyAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('yc_token'));
  const [isAdminSession, setIsAdminSession] = useState(
    localStorage.getItem('yc_admin_session') === 'true',
  );
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem('yc_admin_session') === 'true' ? ADMIN_USER : null,
  );
  const getToken = useCallback(async () => localStorage.getItem('yc_token'), []);

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  const { data, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token && !isAdminSession,
      retry: false,
    },
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    } else if (data === undefined && !isLoading && token && !isAdminSession) {
      setToken(null);
      localStorage.removeItem('yc_token');
    }
  }, [data, isLoading, token, isAdminSession]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setIsAdminSession(false);
    localStorage.setItem('yc_token', newToken);
    localStorage.removeItem('yc_admin_session');
  };

  const adminLogin = (newToken: string) => {
    setToken(newToken);
    setUser(ADMIN_USER);
    setIsAdminSession(true);
    localStorage.setItem('yc_token', newToken);
    localStorage.setItem('yc_admin_session', 'true');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('yc_token');
    localStorage.removeItem('yc_admin_session');
    setIsAdminSession(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        adminLogin,
        logout,
        getToken,
        isAuthenticated: !!token && (!!user || isAdminSession),
        isAdminAuthenticated: isAdminSession,
        isLoading,
        error: null,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const clerkAuth = useClerkAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [isAdminSession, setIsAdminSession] = useState(
    () => localStorage.getItem('yc_admin_session') === 'true',
  );
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('yc_admin_session') === 'true'
      ? localStorage.getItem('yc_token')
      : null,
  );
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem('yc_admin_session') === 'true' ? ADMIN_USER : null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const getToken = useCallback(
    () => isAdminSession
      ? Promise.resolve(localStorage.getItem('yc_token'))
      : clerkAuth.getToken(),
    [clerkAuth.getToken, isAdminSession],
  );

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!clerkAuth.isLoaded || !isUserLoaded) return;
      if (isAdminSession) {
        setIsLoading(false);
        setProfileError(null);
        return;
      }
      if (!clerkAuth.isSignedIn || !clerkUser) {
        setToken(null);
        setUser(null);
        setIsAdminSession(false);
        setProfileError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setProfileError(null);
      try {
        const sessionToken = await getToken();
        if (!sessionToken) throw new Error('Clerk did not provide a session token.');
        setToken(sessionToken);
        const profileResponse = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        let profileResult: { user?: User; isAdmin?: boolean } | null = null;
        if (profileResponse.ok) {
          profileResult = await profileResponse.json();
        } else if (profileResponse.status === 403) {
          const email = clerkUser.primaryEmailAddress?.emailAddress;
          const emailPrefix = email?.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
          const username = clerkUser.username
            || `${emailPrefix || 'member'}_${clerkUser.id.replace(/[^a-zA-Z0-9_]/g, '').slice(-8)}`;
          if (!email || !username) {
            throw new Error('Add a primary email address to your Clerk profile before continuing.');
          }
          const syncResponse = await fetch('/api/auth/clerk-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              firstName: clerkUser.firstName || '',
              lastName: clerkUser.lastName || '',
              username,
              email,
            }),
          });
          const syncResult = await syncResponse.json();
          if (!syncResponse.ok) {
            throw new Error(syncResult.detail || 'Could not link your Clerk account.');
          }
          profileResult = syncResult;
        } else {
          const errorResult = await profileResponse.json().catch(() => ({}));
          throw new Error(errorResult.detail || 'Could not load your account profile.');
        }
        if (active && profileResult?.user) {
          setUser(profileResult.user);
          const adminIds = (import.meta.env.VITE_ADMIN_CLERK_IDS || '')
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean);
          setIsAdminSession(adminIds.includes(clerkUser.id));
        }
      } catch (error) {
        if (active) {
          setUser(null);
          setIsAdminSession(false);
          const message = error instanceof Error
            ? error.message
            : 'Could not load the Clerk user profile.';
          setProfileError(message);
          console.error('Could not load the Clerk user profile.', error);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => { active = false; };
  }, [
    getToken,
    clerkAuth.isLoaded,
    clerkAuth.isSignedIn,
    clerkUser,
    isAdminSession,
    isUserLoaded,
  ]);

  const adminLogin = (adminToken: string) => {
    localStorage.setItem('yc_token', adminToken);
    localStorage.setItem('yc_admin_session', 'true');
    setToken(adminToken);
    setUser(ADMIN_USER);
    setIsAdminSession(true);
    setProfileError(null);
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('yc_token');
    localStorage.removeItem('yc_admin_session');
    setToken(null);
    setUser(null);
    setIsAdminSession(false);
    void clerkAuth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login: () => { throw new Error('Use Clerk sign-in to authenticate.'); },
        adminLogin,
        logout,
        getToken,
        isAuthenticated: isAdminSession || Boolean(clerkAuth.isSignedIn && user),
        isAdminAuthenticated: isAdminSession,
        isLoading: !isAdminSession && (!clerkAuth.isLoaded || !isUserLoaded || isLoading),
        error: profileError,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

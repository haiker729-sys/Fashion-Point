import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface RouteState {
  pathname: string;
  search: string;
}

interface RouterContextValue {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const RAW_BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const BASE_PREFIX = RAW_BASE === '' || RAW_BASE === '/' ? '' : RAW_BASE;

const stripBasePrefix = (rawPath: string): string => {
  if (!BASE_PREFIX) return rawPath || '/';
  if (rawPath === BASE_PREFIX) return '/';
  if (rawPath.startsWith(`${BASE_PREFIX}/`)) {
    return rawPath.slice(BASE_PREFIX.length) || '/';
  }
  return rawPath || '/';
};

const withBasePrefix = (appPath: string): string => {
  const normalized = appPath.startsWith('/') ? appPath : `/${appPath}`;
  if (!BASE_PREFIX) return normalized;
  return normalized === '/' ? `${BASE_PREFIX}/` : `${BASE_PREFIX}${normalized}`;
};

const getCurrentLocation = (): RouteState => {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  return {
    pathname: stripBasePrefix(window.location.pathname || '/'),
    search: window.location.search || '',
  };
};

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loc, setLoc] = useState<RouteState>(getCurrentLocation);

  useEffect(() => {
    const onPopState = () => {
      setLoc(getCurrentLocation());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(to, window.location.origin);
    const nextPath = stripBasePrefix(url.pathname || '/');
    const nextSearch = url.search || '';
    const browserPath = withBasePrefix(nextPath);
    const fullTarget = `${browserPath}${nextSearch}${url.hash}`;

    if (
      window.location.pathname !== browserPath ||
      window.location.search !== nextSearch ||
      window.location.hash !== url.hash
    ) {
      window.history.pushState({}, '', fullTarget);
    }

    setLoc({ pathname: nextPath, search: nextSearch });

    if (url.hash) {
      const targetId = url.hash.slice(1);
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const searchParams = new URLSearchParams(loc.search);

  return (
    <RouterContext.Provider
      value={{
        pathname: loc.pathname,
        search: loc.search,
        searchParams,
        navigate,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside RouterProvider');
  }
  return ctx;
};

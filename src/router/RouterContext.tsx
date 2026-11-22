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

const getCurrentLocation = (): RouteState => {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }
  return {
    pathname: window.location.pathname || '/',
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
    const nextPath = url.pathname || '/';
    const nextSearch = url.search || '';
    const fullTarget = `${nextPath}${nextSearch}${url.hash}`;

    if (
      window.location.pathname !== nextPath ||
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
